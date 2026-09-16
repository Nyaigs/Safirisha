import { prisma } from "../lib/prisma";
import type { Server } from "socket.io";
import { findNearbyDrivers } from "./dispatch.service";
import { getExpiryDate } from "./trip.service";

/**
 * Closes unclaimed dispatches after their server-assigned search window. The
 * conditional update keeps this safe when a driver accepts at the same time.
 */
export async function expireStaleSearchingTrips(io?: Server) {
  const now = new Date();
  const staleTrips = await prisma.transportRequest.findMany({
    where: {
      status: { in: ["SEARCHING", "SEARCHING_DRIVER"] },
      assignedDriverId: null,
      expiresAt: { lte: now },
    },
    select: { id: true },
  });

  for (const staleTrip of staleTrips) {
    const expired = await prisma.transportRequest.updateMany({
      where: {
        id: staleTrip.id,
        status: { in: ["SEARCHING", "SEARCHING_DRIVER"] },
        assignedDriverId: null,
        expiresAt: { lte: now },
      },
      data: { status: "CANCELLED", expiredAt: now, cancelledAt: now },
    });

    if (expired.count !== 1 || !io) continue;

    const payload = { tripId: staleTrip.id, status: "CANCELLED" };
    io.to(`trip:${staleTrip.id}`).emit("trip_status_updated", payload);
    io.to(`trip:${staleTrip.id}`).emit("trip_expired", payload);
    io.emit("admin_stats_updated");
  }
}

export async function processScheduledTrips(io?: Server) {
  const now = new Date();
  const bufferMinutes = 15; // Start searching 15 mins before pickup
  const cutoff = new Date(now.getTime() + bufferMinutes * 60000);

  try {
    const trips = await prisma.transportRequest.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: cutoff, // scheduled time is within the next 15 minutes
          gte: now, // not already past
        },
      },
    });

    for (const trip of trips) {
      const released = await prisma.transportRequest.updateMany({
        where: { id: trip.id, status: "SCHEDULED" },
        data: {
          status: "SEARCHING",
          searchStartedAt: now,
          expiresAt: getExpiryDate(),
        },
      });
      if (released.count !== 1) continue;

      if (io) {
        const candidates = await findNearbyDrivers({
          lat: trip.pickupLat,
          lng: trip.pickupLng,
          vehicleType: trip.vehicleType,
          radiusKm: 10,
        });
        for (const candidate of candidates) {
          io.to(`user:${candidate.userId}`).emit("new_trip_created", {
            ...trip,
            status: "SEARCHING",
          });
        }
        io.emit("admin_stats_updated");
      }

      console.log(`Scheduled trip ${trip.id} released for drivers.`);
    }
  } catch (error) {
    console.error("Error processing scheduled trips:", error);
  }
}
