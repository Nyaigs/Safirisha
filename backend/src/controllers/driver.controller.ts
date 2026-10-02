import { DriverAvailability, RequestStatus } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { buildTripInclude, normalizeVehicleType } from "../services/trip.service";
import { DRIVER_LOCATION_MAX_AGE_MS, hasFreshDriverLocation } from "../services/dispatch.service";
import { calculateDistanceKm } from "../utils/distance";

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

function safeEmitToTrip(req: AuthRequest, tripId: string, event: string, payload: any) {
  try {
    const io = req.app.get("io");
    if (io) io.to(`trip:${tripId}`).emit(event, payload);
  } catch {
    /* socket not initialized */
  }
}

function hasValidCoordinates(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
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
      select: { id: true, currentLat: true, currentLng: true, vehicleType: true, approvalStatus: true, availability: true, lastLocationAt: true },
    });

    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    if (driver.approvalStatus !== "APPROVED") return res.status(403).json({ message: "Your driver account is not approved yet" });
    if (driver.availability !== "ONLINE") return res.status(400).json({ message: "Go online first to view nearby jobs" });
    if (!driver.vehicleType) return res.status(400).json({ message: "Complete your vehicle details before viewing jobs" });
    if (!hasValidCoordinates(driver.currentLat, driver.currentLng) || !hasFreshDriverLocation(driver.lastLocationAt)) {
      return res.status(400).json({ message: "Your location is unavailable or stale. Refresh location and try again." });
    }

    const hasActiveTrip = await prisma.transportRequest.findFirst({ where: { assignedDriverId: driver.id, status: { in: ACTIVE_TRIP_STATUSES } }, select: { id: true } });
    if (hasActiveTrip) return res.status(409).json({ message: "You already have an active trip" });

     const trips = await prisma.transportRequest.findMany({
       where: {
         status: { in: ["SEARCHING", "SEARCHING_DRIVER"] },
       },
       include: { customer: { select: { id: true, fullName: true, phone: true } } },
       orderBy: { createdAt: "desc" },
       take: 50,
     });

    const driverLat = driver.currentLat;
    const driverLng = driver.currentLng;
    if (driverLat == null || driverLng == null) return res.status(400).json({ message: "Your location is unavailable. Refresh location and try again." });

    const nearbyTrips = trips
      .filter((trip) => normalizeVehicleType(trip.vehicleType) === normalizeVehicleType(driver.vehicleType))
      .map((trip) => ({ ...trip, distanceToPickupKm: calculateDistanceKm(driverLat, driverLng, trip.pickupLat, trip.pickupLng) }))
      .filter((trip) => trip.distanceToPickupKm <= 25);

    return res.json({ trips: nearbyTrips });
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
      if (driver.approvalStatus !== "APPROVED") return res.status(403).json({ message: "Your driver account is not approved yet" });
      if (!hasValidCoordinates(driver.currentLat, driver.currentLng) || !hasFreshDriverLocation(driver.lastLocationAt)) {
        return res.status(400).json({ message: `A fresh location is required before going online. Update your location within ${DRIVER_LOCATION_MAX_AGE_MS / 60000} minutes and try again.` });
      }
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
    if (!hasValidCoordinates(lat, lng)) return res.status(400).json({ message: "A valid latitude and longitude are required" });
    if (heading != null && (typeof heading !== "number" || !Number.isFinite(heading))) return res.status(400).json({ message: "Heading must be a valid number" });
    if (speed != null && (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0)) return res.status(400).json({ message: "Speed must be a valid non-negative number" });

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: {
        currentLat: lat,
        currentLng: lng,
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
      currentLat: lat,
      currentLng: lng,
      lat,
      lng,
      heading: heading ?? driver.currentHeading,
      speed: speed ?? driver.currentSpeed,
      updatedAt: new Date().toISOString(),
    };

    safeEmitToUser(req, driver.userId, "driver_location_updated", locationPayload);

    if (activeTrip) {
      safeEmitToTrip(req, activeTrip.id, "driver_location_updated", locationPayload);
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

    if (driver.approvalStatus !== "APPROVED") return res.status(403).json({ message: "Your driver account is not approved yet" });
    if (!hasValidCoordinates(driver.currentLat, driver.currentLng) || !hasFreshDriverLocation(driver.lastLocationAt)) {
      return res.status(400).json({ message: "A fresh location is required before going online" });
    }

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

// ---------- NEW: KYC UPDATE ----------
export async function updateDriverKyc(req: AuthRequest, res: Response) {
  try {
    const {
      plateNumber,
      vehicleType,
      driverLicenseNumber,
      vehicleImageUrl,
      ownershipProofUrl,
      complianceCertificateUrl,
    } = req.body;

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const updated = await prisma.driverProfile.update({
      where: { id: driver.id },
      data: {
        plateNumber: plateNumber ?? driver.plateNumber,
        vehicleType: vehicleType ?? driver.vehicleType,
        driverLicenseNumber: driverLicenseNumber ?? driver.driverLicenseNumber,
        vehicleImageUrl: vehicleImageUrl ?? driver.vehicleImageUrl,
        ownershipProofUrl: ownershipProofUrl ?? driver.ownershipProofUrl,
        complianceCertificateUrl: complianceCertificateUrl ?? driver.complianceCertificateUrl,
        kycSubmittedAt: new Date(),
      },
    });

    return res.json({ message: "KYC updated successfully", driver: updated });
  } catch (error) {
    console.error("updateDriverKyc error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
