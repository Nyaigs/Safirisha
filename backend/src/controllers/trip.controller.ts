import { RequestStatus } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { buildTripFinancials } from "../services/trip-pricing.service";

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

const ACTIVE_DRIVER_TRIP_STATUSES: RequestStatus[] = [
  "ACCEPTED",
  "DRIVER_EN_ROUTE",
  "ARRIVED_PICKUP",
  "PICKUP_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "DELIVERY_CONFIRMED",
  "PAYMENT_PENDING",
];

function buildTripInclude() {
  return {
    customer: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        username: true,
      },
    },
    assignedDriver: {
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            username: true,
          },
        },
      },
    },
  } as const;
}

function emitTripUpdated(req: AuthRequest, trip: any) {
  const io = req.app.get("io");
  if (!io) return;

  io.to(`trip:${trip.id}`).emit("trip_updated", { trip });
  io.to(`trip:${trip.id}`).emit("trip_status_updated", {
    tripId: trip.id,
    status: trip.status,
    paymentMethod: trip.paymentMethod ?? null,
    paymentStatus: trip.paymentStatus ?? null,
  });

  io.emit("admin_stats_updated");
}

function emitNewTripCreated(req: AuthRequest, trip: any) {
  const io = req.app.get("io");
  if (!io) return;

  io.emit("new_trip_created", trip);
  io.emit("admin_stats_updated");
}

function emitTripAccepted(
  req: AuthRequest,
  payload: {
    trip: any;
    driver: {
      id: string;
      name: string;
      phone: string;
      plateNumber: string;
      vehicleType: string;
    } | null;
  },
) {
  const io = req.app.get("io");
  if (!io) return;

  io.to(`trip:${payload.trip.id}`).emit("trip_accepted", {
    tripId: payload.trip.id,
    status: payload.trip.status,
    driver: payload.driver,
    trip: payload.trip,
  });

  emitTripUpdated(req, payload.trip);
}

export async function createTripRequest(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      vehicleType,
      loadDescription,
      loadSize,
      specialNotes,
      estimatedPrice,
      distanceKm,
    } = req.body as {
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
      dropoffAddress?: string;
      dropoffLat?: number;
      dropoffLng?: number;
      vehicleType?: string;
      loadDescription?: string;
      loadSize?: string;
      specialNotes?: string;
      estimatedPrice?: number;
      distanceKm?: number;
    };

    if (
      !pickupAddress ||
      pickupLat == null ||
      pickupLng == null ||
      !dropoffAddress ||
      dropoffLat == null ||
      dropoffLng == null ||
      !vehicleType ||
      !loadSize ||
      estimatedPrice == null ||
      distanceKm == null
    ) {
      return res.status(400).json({
        message:
          "pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, vehicleType, loadSize, estimatedPrice and distanceKm are required",
      });
    }

    const normalizedVehicleType = normalizeVehicleType(vehicleType);
    const financials = buildTripFinancials(Number(estimatedPrice));

    const trip = await prisma.transportRequest.create({
      data: {
        customerId,
        pickupAddress,
        pickupLat: Number(pickupLat),
        pickupLng: Number(pickupLng),
        dropoffAddress,
        dropoffLat: Number(dropoffLat),
        dropoffLng: Number(dropoffLng),
        vehicleType: normalizedVehicleType,
        loadDescription: loadDescription?.trim() || null,
        loadSize: String(loadSize).trim().toUpperCase(),
        specialNotes: specialNotes?.trim() || null,
        estimatedPrice: Number(estimatedPrice),
        distanceKm: Number(distanceKm),
        status: "SEARCHING",
        paymentStatus: "UNPAID",
        platformFeePercent: financials.platformFeePercent,
        platformFeeAmount: financials.platformFeeAmount,
        driverNetEarning: financials.driverNetEarning,
      },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, trip);
    emitNewTripCreated(req, trip);

    return res.status(201).json({
      message: "Trip request created successfully",
      trip,
    });
  } catch (error) {
    console.error("createTripRequest error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyTrips(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trips = await prisma.transportRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: buildTripInclude(),
    });

    return res.json({ trips });
  } catch (error) {
    console.error("getMyTrips error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyTripStats(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [totalTrips, completedTrips, cancelledTrips] = await Promise.all([
      prisma.transportRequest.count({
        where: { customerId },
      }),
      prisma.transportRequest.count({
        where: {
          customerId,
          status: "DELIVERED",
        },
      }),
      prisma.transportRequest.count({
        where: {
          customerId,
          status: "CANCELLED",
        },
      }),
    ]);

    return res.json({
      totalTrips,
      completedTrips,
      cancelledTrips,
    });
  } catch (error) {
    console.error("getMyTripStats error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMyDriverActiveTrip(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const trip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: {
          in: ACTIVE_DRIVER_TRIP_STATUSES,
        },
      },
      orderBy: { updatedAt: "desc" },
      include: buildTripInclude(),
    });

    return res.json({ trip: trip ?? null });
  } catch (error) {
    console.error("getMyDriverActiveTrip error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getTripById(req: AuthRequest, res: Response) {
  try {
    const tripId = String(req.params.id || "");
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const allowed =
      role === "ADMIN" ||
      trip.customerId === userId ||
      trip.assignedDriver?.userId === userId;

    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ trip });
  } catch (error) {
    console.error("getTripById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function acceptTripRequest(req: AuthRequest, res: Response) {
  try {
    const tripId = String(req.params.id || "");
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            isActive: true,
          },
        },
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
        message: "Your driver account is not approved yet",
      });
    }

    const existingActiveTrip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: { in: ACTIVE_DRIVER_TRIP_STATUSES },
      },
      select: { id: true },
    });

    if (existingActiveTrip || driver.availability === "BUSY") {
      return res.status(409).json({
        message: "You already have an active trip",
      });
    }

    const foundTrip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
    });

    if (!foundTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (foundTrip.status !== "SEARCHING") {
      return res.status(409).json({
        message: "This trip has already been taken or is no longer available",
      });
    }

    const tripVehicle = normalizeVehicleType(foundTrip.vehicleType);
    const driverVehicle = normalizeVehicleType(driver.vehicleType);

    if (tripVehicle !== driverVehicle) {
      return res.status(400).json({
        message: "This trip does not match your vehicle type",
      });
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const claimed = await tx.transportRequest.updateMany({
        where: {
          id: tripId,
          status: "SEARCHING",
          assignedDriverId: null,
        },
        data: {
          assignedDriverId: driver.id,
          status: "ACCEPTED",
        },
      });

      if (claimed.count !== 1) {
        throw new Error("TRIP_ALREADY_TAKEN");
      }

      await tx.driverProfile.update({
        where: { id: driver.id },
        data: {
          availability: "BUSY",
        },
      });

      return tx.transportRequest.findUnique({
        where: { id: tripId },
        include: buildTripInclude(),
      });
    });

    if (!updatedTrip) {
      return res.status(404).json({ message: "Trip not found after accept" });
    }

    emitTripAccepted(req, {
      trip: updatedTrip,
      driver: {
        id: driver.id,
        name: driver.user.fullName,
        phone: driver.user.phone || "",
        plateNumber: driver.plateNumber || "",
        vehicleType: driver.vehicleType || "",
      },
    });

    return res.json({
      message: "Trip accepted successfully",
      trip: updatedTrip,
    });
  } catch (error: any) {
    if (error?.message === "TRIP_ALREADY_TAKEN") {
      return res.status(409).json({
        message: "This trip has already been taken or is no longer available",
      });
    }

    console.error("acceptTripRequest error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateTripStatus(req: AuthRequest, res: Response) {
  try {
    const tripId = String(req.params.id || "");
    const userId = req.user?.id;
    const status = String(
      req.body?.status || "",
    ).toUpperCase() as RequestStatus;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const allowedStatuses: RequestStatus[] = [
      "DRIVER_EN_ROUTE",
      "ARRIVED_PICKUP",
      "IN_TRANSIT",
      "ARRIVED_DROPOFF",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status update",
      });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: { assignedDriver: true },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assignedDriverId !== driver.id) {
      return res.status(403).json({
        message: "You can only update your own assigned trip",
      });
    }

    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      SEARCHING: [],
      ACCEPTED: ["DRIVER_EN_ROUTE"],
      DRIVER_EN_ROUTE: ["ARRIVED_PICKUP"],
      ARRIVED_PICKUP: [],
      PICKUP_CONFIRMED: ["IN_TRANSIT"],
      IN_TRANSIT: ["ARRIVED_DROPOFF"],
      ARRIVED_DROPOFF: [],
      DELIVERY_CONFIRMED: [],
      PAYMENT_PENDING: [],
      DELIVERED: [],
      CANCELLED: [],
    };

    const nextAllowed = validTransitions[trip.status] || [];
    if (!nextAllowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot move trip from ${trip.status} to ${status}`,
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: { status },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Trip status updated successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("updateTripStatus error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function confirmPickupByCustomer(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || req.params.tripId || "");

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res.status(403).json({
        message: "You can only confirm pickup for your own trip",
      });
    }

    if (trip.status !== "ARRIVED_PICKUP") {
      return res.status(400).json({
        message: "Pickup can only be confirmed when driver has arrived",
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: { status: "PICKUP_CONFIRMED" },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Pickup confirmed successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("confirmPickupByCustomer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function confirmDeliveryByCustomer(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || req.params.tripId || "");

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res.status(403).json({
        message: "You can only confirm delivery for your own trip",
      });
    }

    if (trip.status !== "ARRIVED_DROPOFF") {
      return res.status(400).json({
        message:
          "Delivery can only be confirmed when driver has arrived at drop-off",
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: { status: "DELIVERY_CONFIRMED" },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Delivery confirmed successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("confirmDeliveryByCustomer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function completeTripAfterDeliveryConfirmation(
  req: AuthRequest,
  res: Response,
) {
  return res.status(400).json({
    message:
      "Trip completion now depends on payment confirmation. Use the payment flow instead.",
  });
}

export async function cancelTripByCustomer(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || req.params.tripId || "");

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: {
        customer: true,
        assignedDriver: {
          include: { user: true },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own trip" });
    }

    const cancellableStatuses: RequestStatus[] = [
      "SEARCHING",
      "ACCEPTED",
      "DRIVER_EN_ROUTE",
    ];

    if (!cancellableStatuses.includes(trip.status)) {
      return res.status(400).json({
        message: `Trip cannot be cancelled once it is ${String(trip.status).replace(/_/g, " ").toLowerCase()}`,
      });
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const nextTrip = await tx.transportRequest.update({
        where: { id: tripId },
        data: {
          status: "CANCELLED",
          paymentStatus:
            trip.paymentStatus === "PAID" ? trip.paymentStatus : "FAILED",
        },
        include: buildTripInclude(),
      });

      if (trip.assignedDriverId) {
        await tx.driverProfile.update({
          where: { id: trip.assignedDriverId },
          data: { availability: "ONLINE" },
        });
      }

      return nextTrip;
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Trip cancelled successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("cancelTripByCustomer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
