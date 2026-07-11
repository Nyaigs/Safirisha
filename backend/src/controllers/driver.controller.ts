import { DriverAvailability, RequestStatus } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { buildTripInclude } from "../services/trip.service";

const ACTIVE_TRIP_STATUSES: RequestStatus[] = [
  "ACCEPTED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING",
];

function safeEmit(req: AuthRequest, event: string, payload: any) {
  try {
    const io = req.app.get("io");
    if (io) io.emit(event, payload);
  } catch {
    /* socket not initialized */
  }
}

function safeEmitToUser(req: AuthRequest, userId: string, event: string, payload: any) {
  try {
    const io = req.app.get("io");
    if (io) io.to(`user:${userId}`).emit(event, payload);
  } catch {
    /* socket not initialized */
  }
}

export async function getMyDriverProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, username: true } } },
    });

    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    return res.json({
      ...driver,
      fullName: driver.user.fullName,
      email: driver.user.email,
      phone: driver.user.phone,
      role: driver.user.role,
      isActive: driver.user.isActive,
      username: driver.user.username,
    });
  } catch (error) {
    console.error("[getMyDriverProfile]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyActiveTrip(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.json(null);

    const trip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: { in: ACTIVE_TRIP_STATUSES },
      },
      include: buildTripInclude(),
      orderBy: { createdAt: "desc" },
    });

    return res.json({ trip });
  } catch (error) {
    console.error("[getMyActiveTrip]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getNearbyTripRequests(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, currentLat: true, currentLng: true, vehicleType: true },
    });

    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

     const trips = await prisma.transportRequest.findMany({
       where: {
         status: "SEARCHING_DRIVER",
         vehicleType: driver.vehicleType || undefined,
       },
       include: { customer: { select: { id: true, fullName: true, phone: true } } },
       orderBy: { createdAt: "desc" },
       take: 20,
     });

    return res.json({ trips });
  } catch (error) {
    console.error("[getNearbyTripRequests]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverAvailability(req: AuthRequest, res: Response) {
  try {
    const { availability } = req.body;
    const allowed: DriverAvailability[] = ["ONLINE", "OFFLINE", "BUSY"];

    if (!availability || !allowed.includes(availability)) {
      return res.status(400).json({ message: "Invalid availability" });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (availability === "ONLINE") {
      const activeTrip = await prisma.transportRequest.findFirst({
        where: { assignedDriverId: driver.id, status: { in: ACTIVE_TRIP_STATUSES } },
      });
      if (activeTrip) {
        return res.status(400).json({ message: "Cannot go ONLINE during active trip" });
      }
    }

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: { availability },
    });

    safeEmit(req, "driver_availability_updated", { driverId: driver.id, availability });

    return res.json(updated);
  } catch (error) {
    console.error("[updateDriverAvailability]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverLocation(req: AuthRequest, res: Response) {
  try {
    const { lat, lng, heading, speed } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: {
        currentLat: lat ?? driver.currentLat,
        currentLng: lng ?? driver.currentLng,
        currentHeading: heading ?? driver.currentHeading,
        currentSpeed: speed ?? driver.currentSpeed,
        lastLocationAt: new Date(),
      },
    });

     const activeTrip = await prisma.transportRequest.findFirst({
       where: {
         assignedDriverId: driver.id,
         status: { in: ["ACCEPTED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING"] },
       },
       select: { id: true },
     });

    const locationPayload = {
      id: driver.userId,
      driverId: driver.id,
      tripId: activeTrip?.id ?? null,
      currentLat: lat ?? driver.currentLat,
      currentLng: lng ?? driver.currentLng,
      lat: lat ?? driver.currentLat,
      lng: lng ?? driver.currentLng,
      heading: heading ?? driver.currentHeading,
      speed: speed ?? driver.currentSpeed,
      updatedAt: new Date().toISOString(),
    };

    safeEmitToUser(req, driver.userId, "driver_location_updated", locationPayload);

    if (activeTrip) {
      safeEmitToUser(req, `trip:${activeTrip.id}`, "driver_location_updated", locationPayload);
    }

    return res.json(updated);
  } catch (error) {
    console.error("[updateDriverLocation]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function goOnline(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const activeTrip = await prisma.transportRequest.findFirst({
      where: { assignedDriverId: driver.id, status: { in: ACTIVE_TRIP_STATUSES } },
    });

    if (activeTrip) {
      return res.status(400).json({ message: "Cannot go ONLINE during active trip" });
    }

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: { availability: "ONLINE" },
    });

    safeEmit(req, "driver_availability_updated", { driverId: driver.id, availability: "ONLINE" });

    return res.json(updated);
  } catch (error) {
    console.error("[goOnline]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function goOffline(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: { availability: "OFFLINE" },
    });

    safeEmit(req, "driver_availability_updated", { driverId: driver.id, availability: "OFFLINE" });

    return res.json(updated);
  } catch (error) {
    console.error("[goOffline]", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function acceptTrip(req: AuthRequest, res: Response) {
  try {
    const { tripId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if (driver.approvalStatus !== "APPROVED") {
      return res.status(403).json({ message: "Driver not approved" });
    }

    const activeTripCheck = await prisma.transportRequest.findFirst({
      where: { assignedDriverId: driver.id, status: { in: ACTIVE_TRIP_STATUSES } },
    });
    if (activeTripCheck) {
      return res.status(409).json({ message: "You already have an active trip" });
    }

     const updated = await prisma.$transaction(async (tx) => {
       const claimed = await tx.transportRequest.updateMany({
         where: { id: String(tripId), status: "SEARCHING_DRIVER", assignedDriverId: null },
         data: { assignedDriverId: driver.id, status: "DRIVER_ASSIGNED", acceptedAt: new Date() },
       });

       if (claimed.count === 0) throw new AppError(409, "Trip already taken");

       await tx.driverProfile.update({
         where: { id: driver.id },
         data: { availability: "BUSY" },
       });

       return tx.transportRequest.findUnique({
         where: { id: String(tripId) },
         include: buildTripInclude(),
       });
     });

    if (updated) {
      safeEmit(req, "trip_accepted", {
        tripId,
        status: "ACCEPTED",
        driver: {
          id: updated.assignedDriver?.id || "",
          name: updated.assignedDriver?.user?.fullName || "Driver",
          phone: updated.assignedDriver?.user?.phone || "",
          plateNumber: updated.assignedDriver?.plateNumber || "",
          vehicleType: updated.assignedDriver?.vehicleType || "",
        },
      });
    }

    return res.json({ message: "Trip accepted", trip: updated });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("[acceptTrip]", error);
    return res.status(500).json({ message: "Server error" });
  }
}
