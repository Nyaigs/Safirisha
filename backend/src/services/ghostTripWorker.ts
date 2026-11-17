import { prisma } from "../lib/prisma";
import type { Server } from "socket.io";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * H-01: Prevents Ghost Trips.
 * If a driver accepts a trip but their app crashes/disconnects for > 5 minutes,
 * revert the trip to SEARCHING so the customer isn't left waiting forever.
 */
export async function revertGhostTrips(io?: Server) {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD_MS);

  try {
    const ghostTrips = await prisma.transportRequest.findMany({
      where: {
        status: { in: ["ACCEPTED", "DRIVER_EN_ROUTE"] },
        assignedDriverId: { not: null },
        assignedDriver: {
          lastLocationAt: { lt: staleTime }
        }
      },
      select: { id: true, assignedDriverId: true }
    });

    if (ghostTrips.length === 0) return;

    for (const trip of ghostTrips) {
      const reverted = await prisma.transportRequest.updateMany({
        where: {
          id: trip.id,
          assignedDriverId: trip.assignedDriverId,
          status: { in: ["ACCEPTED", "DRIVER_EN_ROUTE"] }
        },
        data: {
          status: "SEARCHING",
          assignedDriverId: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        }
      });

      if (reverted.count === 1) {
        console.log(`[GhostTrip] Reverted stale trip ${trip.id}. Driver connection lost.`);

        if (trip.assignedDriverId) {
          await prisma.driverProfile.update({
            where: { id: trip.assignedDriverId },
            data: { availability: "OFFLINE" }
          });
        }

        if (io) {
          io.to(`trip:${trip.id}`).emit("trip_status_updated", {
            tripId: trip.id,
            status: "SEARCHING",
            message: "Driver connection lost. We are finding a new driver for you."
          });
          
          io.emit("admin_stats_updated");
        }
      }
    }
  } catch (error) {
    console.error("[GhostTripWorker] Error:", error);
  }
}
