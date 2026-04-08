import { RequestStatus } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { getIO } from "../socket";
import {
  haversineKm,
  isValidKenyanPlate,
  normalizeKenyanPlate,
} from "../utils/validators";

type NearbyTrip = {
  id: string;
  customerId: string;
  assignedDriverId: string | null;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  loadDescription: string | null;
  loadSize: string;
  specialNotes: string | null;
  estimatedPrice: number;
  distanceKm: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  distanceToPickupKm: number;
};

const MAX_DISTANCE_KM = 10;
const ACTIVE_TRIP_STATUSES: RequestStatus[] = [
  "ACCEPTED",
  "DRIVER_EN_ROUTE",
  "ARRIVED_PICKUP",
  "PICKUP_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "DELIVERY_CONFIRMED",
  "PAYMENT_PENDING",
];

function normalizeVehicleType(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const aliases: Record<string, string> = {
    BIKE: "BIKE",
    MOTORBIKE: "BIKE",
    BODA: "BIKE",
    TUKTUK: "TUKTUK",
    TUK_TUK: "TUKTUK",
    TUK: "TUKTUK",
    PICKUP: "PICKUP",
    PICK_UP: "PICKUP",
    LORRY: "MEDIUM_LORRY",
    MEDIUM_LORRY: "MEDIUM_LORRY",
    MEDIUMLORRY: "MEDIUM_LORRY",
    LARGE_TRUCK: "LARGE_TRUCK",
    LARGETRUCK: "LARGE_TRUCK",
    TRUCK: "LARGE_TRUCK",
  };

  return aliases[normalized] ?? normalized;
}

function emitAdminStatsUpdated() {
  const io = getIO();
  io.emit("admin_stats_updated");
}

function buildDriverResponse(driver: any) {
  return {
    id: driver.id,
    userId: driver.userId,
    fullName: driver.user.fullName,
    email: driver.user.email,
    phone: driver.user.phone,
    role: driver.user.role,
    isActive: driver.user.isActive,
    suspensionReason: driver.user.suspensionReason,
    plateNumber: driver.plateNumber,
    vehicleType: driver.vehicleType,
    vehicleImageUrl: driver.vehicleImageUrl,
    ownershipProofUrl: driver.ownershipProofUrl,
    approvalStatus: driver.approvalStatus,
    availability: driver.availability,
    currentLat: driver.currentLat,
    currentLng: driver.currentLng,
    currentHeading: driver.currentHeading,
    currentSpeed: driver.currentSpeed,
    lastLocationAt: driver.lastLocationAt,
    createdAt: driver.user.createdAt,
    updatedAt: driver.user.updatedAt,
  };
}

export async function getMyDriverProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    return res.json({
      driver: buildDriverResponse(driver),
    });
  } catch (error) {
    console.error("getMyDriverProfile error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverKyc(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { plateNumber, vehicleType } = req.body as {
      plateNumber?: string;
      vehicleType?: string;
    };

    const files = req.files as
      | {
          [fieldname: string]: Express.Multer.File[];
        }
      | undefined;

    const vehicleImage = files?.vehicleImage?.[0];
    const ownershipProof = files?.ownershipProof?.[0];

    if (!plateNumber || !vehicleType || !vehicleImage || !ownershipProof) {
      return res.status(400).json({
        message:
          "plateNumber, vehicleType, vehicleImage and ownershipProof are required",
      });
    }

    const normalizedPlate = normalizeKenyanPlate(plateNumber);

    if (!isValidKenyanPlate(normalizedPlate)) {
      return res.status(400).json({
        message: "Invalid Kenyan plate number format. Example: KDA 123A",
      });
    }

    const normalizedVehicle = normalizeVehicleType(vehicleType);

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const existingPlate = await prisma.driverProfile.findFirst({
      where: {
        plateNumber: normalizedPlate,
        id: { not: driver.id },
      },
    });

    if (existingPlate) {
      return res.status(409).json({
        message: "Vehicle plate number already exists",
      });
    }

    const updatedDriver = await prisma.driverProfile.update({
      where: { userId },
      data: {
        plateNumber: normalizedPlate,
        vehicleType: normalizedVehicle,
        vehicleImageUrl: `/uploads/${vehicleImage.filename}`,
        ownershipProofUrl: `/uploads/${ownershipProof.filename}`,
        approvalStatus: "PENDING",
      },
      include: {
        user: true,
      },
    });

    emitAdminStatsUpdated();

    return res.json({
      message: "Driver KYC updated successfully",
      driver: buildDriverResponse(updatedDriver),
    });
  } catch (error) {
    console.error("updateDriverKyc error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyActiveTrip(req: AuthRequest, res: Response) {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user?.id },
      include: {
        user: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const trip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: {
          in: ACTIVE_TRIP_STATUSES,
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        assignedDriver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return res.json({ trip: trip || null });
  } catch (error) {
    console.error("getMyActiveTrip error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverAvailability(
  req: AuthRequest,
  res: Response,
) {
  try {
    const { availability } = req.body as {
      availability?: "ONLINE" | "OFFLINE";
    };

    if (!availability || !["ONLINE", "OFFLINE"].includes(availability)) {
      return res
        .status(400)
        .json({ message: "Availability must be ONLINE or OFFLINE" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user?.id },
      include: {
        user: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    if (!driver.user.isActive) {
      return res.status(403).json({ message: "Driver account is suspended" });
    }

    if (driver.approvalStatus !== "APPROVED") {
      return res.status(403).json({ message: "Driver is not approved yet" });
    }

    if (
      availability === "ONLINE" &&
      (driver.currentLat == null || driver.currentLng == null)
    ) {
      return res.status(400).json({
        message: "Sync driver location before going online",
      });
    }

    const activeTrip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: {
          in: ACTIVE_TRIP_STATUSES,
        },
      },
    });

    if (activeTrip && availability === "OFFLINE") {
      return res.status(400).json({
        message: "You cannot go offline while an active trip is in progress",
      });
    }

    const updatedDriver = await prisma.driverProfile.update({
      where: { userId: req.user?.id },
      data: { availability },
      include: {
        user: true,
      },
    });

    const io = getIO();

    emitAdminStatsUpdated();

    io.emit("driver_location_updated", {
      id: updatedDriver.id,
      driverId: updatedDriver.id,
      name: updatedDriver.user.fullName,
      currentLat: updatedDriver.currentLat,
      currentLng: updatedDriver.currentLng,
      lat: updatedDriver.currentLat,
      lng: updatedDriver.currentLng,
      heading: updatedDriver.currentHeading,
      speed: updatedDriver.currentSpeed,
      updatedAt:
        updatedDriver.lastLocationAt?.toISOString?.() ??
        new Date().toISOString(),
      availability: updatedDriver.availability,
      vehicleType: updatedDriver.vehicleType,
      plateNumber: updatedDriver.plateNumber,
      isActive: updatedDriver.user.isActive,
    });

    return res.json({
      message: "Driver availability updated",
      driver: buildDriverResponse(updatedDriver),
    });
  } catch (error) {
    console.error("updateDriverAvailability error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverLocation(req: AuthRequest, res: Response) {
  try {
    const { lat, lng, heading, speed } = req.body as {
      lat?: number;
      lng?: number;
      heading?: number;
      speed?: number;
    };

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "lat and lng must be numbers" });
    }

    const updatedDriver = await prisma.driverProfile.update({
      where: { userId: req.user?.id },
      data: {
        currentLat: lat,
        currentLng: lng,
        currentHeading: typeof heading === "number" ? heading : null,
        currentSpeed: typeof speed === "number" ? speed : null,
        lastLocationAt: new Date(),
      },
      include: {
        user: true,
        acceptedRequests: {
          where: {
            status: {
              in: ACTIVE_TRIP_STATUSES,
            },
          },
        },
      },
    });

    const io = getIO();

    const realtimePayload = {
      id: updatedDriver.id,
      driverId: updatedDriver.id,
      name: updatedDriver.user.fullName,
      currentLat: updatedDriver.currentLat,
      currentLng: updatedDriver.currentLng,
      lat,
      lng,
      heading: typeof heading === "number" ? heading : null,
      speed: typeof speed === "number" ? speed : null,
      updatedAt:
        updatedDriver.lastLocationAt?.toISOString?.() ??
        new Date().toISOString(),
      availability: updatedDriver.availability,
      vehicleType: updatedDriver.vehicleType,
      plateNumber: updatedDriver.plateNumber,
      isActive: updatedDriver.user.isActive,
    };

    io.emit("driver_location_updated", realtimePayload);

    updatedDriver.acceptedRequests.forEach((trip) => {
      io.to(`trip:${trip.id}`).emit("driver_location_updated", {
        ...realtimePayload,
        tripId: trip.id,
      });
    });

    return res.json({
      message: "Driver location updated",
      driver: {
        id: updatedDriver.id,
        currentLat: updatedDriver.currentLat,
        currentLng: updatedDriver.currentLng,
        currentHeading: updatedDriver.currentHeading,
        currentSpeed: updatedDriver.currentSpeed,
        lastLocationAt: updatedDriver.lastLocationAt,
        availability: updatedDriver.availability,
      },
    });
  } catch (error) {
    console.error("updateDriverLocation error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getNearbyTripRequests(req: AuthRequest, res: Response) {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user?.id },
      include: {
        user: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    if (!driver.user.isActive) {
      return res.status(403).json({ message: "Driver account is suspended" });
    }

    if (driver.approvalStatus !== "APPROVED") {
      return res.status(403).json({
        message: "Driver is not approved yet",
      });
    }

    if (!driver.vehicleType) {
      return res.status(400).json({
        message: "Complete driver KYC first before viewing nearby requests",
      });
    }

    if (driver.currentLat == null || driver.currentLng == null) {
      return res.status(400).json({ message: "Driver location not set yet" });
    }

    const trips = await prisma.transportRequest.findMany({
      where: {
        status: "SEARCHING",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const normalizedDriverVehicle = normalizeVehicleType(driver.vehicleType);

    const nearbyTrips: NearbyTrip[] = trips
      .filter(
        (trip) =>
          normalizeVehicleType(trip.vehicleType) === normalizedDriverVehicle,
      )
      .map((trip) => {
        const distanceToPickupKm = haversineKm(
          driver.currentLat as number,
          driver.currentLng as number,
          trip.pickupLat,
          trip.pickupLng,
        );

        return { ...trip, distanceToPickupKm };
      })
      .filter((trip) => trip.distanceToPickupKm <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);

    return res.json({ trips: nearbyTrips });
  } catch (error) {
    console.error("getNearbyTripRequests error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function createDriverDeletionRequest(
  req: AuthRequest,
  res: Response,
) {
  try {
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) {
      return res.status(400).json({ message: "Deletion reason is required" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user?.id },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const existingPendingRequest = await prisma.driverDeletionRequest.findFirst(
      {
        where: { driverId: driver.id, status: "PENDING" },
      },
    );

    if (existingPendingRequest) {
      return res
        .status(409)
        .json({ message: "You already have a pending deletion request" });
    }

    const deletionRequest = await prisma.driverDeletionRequest.create({
      data: {
        driverId: driver.id,
        reason: reason.trim(),
      },
    });

    return res.status(201).json({
      message: "Deletion request submitted successfully",
      deletionRequest,
    });
  } catch (error) {
    console.error("createDriverDeletionRequest error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyDriverDeletionRequests(
  req: AuthRequest,
  res: Response,
) {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user?.id },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const deletionRequests = await prisma.driverDeletionRequest.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ deletionRequests });
  } catch (error) {
    console.error("getMyDriverDeletionRequests error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
