import { RequestStatus } from "@prisma/client";
import { Response } from "express";
import { CANCELLATION_FEES } from "../constants/cancellation";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { buildTripFinancials, calculateTripPrice, isVehicleSuitableForLoad } from "../services/trip-pricing.service";
import { DRIVER_LOCATION_MAX_AGE_MS, findNearbyDrivers, hasFreshDriverLocation } from "../services/dispatch.service";
import { createNotification } from "../services/notification.service";
import { getExpiryDate } from "../services/trip.service";

const DRIVER_ACCEPT_RADIUS_KM = 10;

const STATUS_NOTIFICATIONS: Partial<
  Record<RequestStatus, { type: any; title: string; message: string }>
> = {
  DRIVER_EN_ROUTE: {
    type: "driver_en_route",
    title: "Driver on the way",
    message: "Your driver is heading to the pickup location.",
  },
  ARRIVED_PICKUP: {
    type: "driver_arrived_pickup",
    title: "Driver has arrived",
    message: "Your driver is at the pickup location.",
  },
  PICKUP_CONFIRMED: {
    type: "pickup_confirmed",
    title: "Pickup confirmed",
    message: "Your delivery has been picked up and is on the way.",
  },
  IN_TRANSIT: {
    type: "in_transit",
    title: "In transit",
    message: "Your delivery is on the move.",
  },
  ARRIVED_DROPOFF: {
    type: "arrived_dropoff",
    title: "Driver has arrived",
    message: "Your driver has arrived at the drop-off location.",
  },
  DELIVERY_CONFIRMED: {
    type: "delivery_confirmed",
    title: "Delivery confirmed",
    message: "Your delivery has been confirmed.",
  },
  COMPLETED: {
    type: "trip_completed",
    title: "Trip completed",
    message: "Your trip has been completed. Tap to rate your driver.",
  },
  DELIVERED: {
    type: "trip_completed",
    title: "Trip completed",
    message: "Your trip has been completed. Tap to rate your driver.",
  },
};

async function notifyCustomerTripStatus(trip: {
  id: string;
  customerId: string;
  status: RequestStatus;
}) {
  const template = STATUS_NOTIFICATIONS[trip.status];
  if (!template) return;
  try {
    await createNotification({
      userId: trip.customerId,
      type: template.type,
      title: template.title,
      message: template.message,
      tripId: trip.id,
    });
  } catch (error) {
    console.error("notifyCustomerTripStatus failed:", error);
  }
}


function hasValidCoordinates(lat: number | null, lng: number | null) {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

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

function calculateDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

const ACTIVE_DRIVER_TRIP_STATUSES: RequestStatus[] = [
  RequestStatus.ACCEPTED,
  RequestStatus.DRIVER_EN_ROUTE,
  RequestStatus.ARRIVED_PICKUP,
  RequestStatus.PICKUP_CONFIRMED,
  RequestStatus.IN_TRANSIT,
  RequestStatus.ARRIVED_DROPOFF,
  RequestStatus.DELIVERY_CONFIRMED,
  RequestStatus.PAYMENT_PENDING,
];

const ACTIVE_CUSTOMER_TRIP_STATUSES: RequestStatus[] = [
  RequestStatus.SEARCHING,
  RequestStatus.SEARCHING_DRIVER,
  RequestStatus.DRIVER_ASSIGNED,
  RequestStatus.ACCEPTED,
  RequestStatus.DRIVER_EN_ROUTE,
  RequestStatus.DRIVER_ARRIVED,
  RequestStatus.ARRIVED_PICKUP,
  RequestStatus.PICKUP_CONFIRMED,
  RequestStatus.IN_TRANSIT,
  RequestStatus.ARRIVED_DROPOFF,
  RequestStatus.DELIVERY_CONFIRMED,
  RequestStatus.COMPLETED_PENDING_CONFIRMATION,
  RequestStatus.PAYMENT_PENDING,
];

const SEARCHABLE_TRIP_STATUSES: RequestStatus[] = [
  RequestStatus.SEARCHING,
  RequestStatus.SEARCHING_DRIVER,
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

async function emitNewTripCreated(req: AuthRequest, trip: any) {
  const io = req.app.get("io");
  if (!io) return;

  const candidates = await findNearbyDrivers({
    lat: trip.pickupLat,
    lng: trip.pickupLng,
    vehicleType: trip.vehicleType,
    radiusKm: 10,
  });
  for (const candidate of candidates) io.to(`user:${candidate.userId}`).emit("new_trip_created", trip);
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

  // Broadcast to all drivers that this trip is taken
  io.emit("trip_taken", { tripId: payload.trip.id });
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
      scheduledFor, // NEW: ISO datetime string
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
      scheduledFor?: string;
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

    const coordinates = [pickupLat, pickupLng, dropoffLat, dropoffLng].map(Number);
    if (!coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[2]) > 90 || Math.abs(coordinates[1]) > 180 || Math.abs(coordinates[3]) > 180) {
      return res.status(400).json({ message: "Pickup and drop-off coordinates must be valid." });
    }

    const calculatedDistanceKm = calculateDistanceKm(coordinates[0], coordinates[1], coordinates[2], coordinates[3]);
    if (calculatedDistanceKm <= 0) {
      return res.status(400).json({ message: "Pickup and drop-off must be different locations." });
    }

    const normalizedVehicleType = normalizeVehicleType(vehicleType);
    const normalizedLoadSize = String(loadSize).trim().toUpperCase().replace(/\s+/g, "_");
    const calculatedPrice = calculateTripPrice(normalizedVehicleType, normalizedLoadSize, calculatedDistanceKm);
    if (calculatedPrice === null || !isVehicleSuitableForLoad(normalizedVehicleType, normalizedLoadSize)) {
      return res.status(400).json({ message: "The selected vehicle or load size is not supported." });
    }
    if (normalizedLoadSize === "CUSTOM" && !loadDescription?.trim()) {
      return res.status(400).json({ message: "Describe the custom load before requesting a driver." });
    }

    let status: RequestStatus = RequestStatus.SEARCHING;
    let scheduledDate: Date | null = null;

    if (scheduledFor) {
      const date = new Date(scheduledFor);
      const minimumScheduledTime = new Date(Date.now() + 15 * 60 * 1000);
      if (isNaN(date.getTime()) || date < minimumScheduledTime) {
        return res
          .status(400)
          .json({ message: "Scheduled pickup must be at least 15 minutes from now." });
      }
      scheduledDate = date;
      status = RequestStatus.SCHEDULED;
    }

    const financials = buildTripFinancials(calculatedPrice);

    const trip = await prisma.transportRequest.create({
      data: {
        customerId,
        pickupAddress,
        pickupLat: coordinates[0],
        pickupLng: coordinates[1],
        dropoffAddress,
        dropoffLat: coordinates[2],
        dropoffLng: coordinates[3],
        vehicleType: normalizedVehicleType,
        loadDescription: loadDescription?.trim() || null,
        loadSize: normalizedLoadSize,
        specialNotes: specialNotes?.trim() || null,
        estimatedPrice: calculatedPrice,
        distanceKm: calculatedDistanceKm,
        status: status,
        scheduledFor: scheduledDate,
        searchStartedAt: status === RequestStatus.SEARCHING ? new Date() : null,
        expiresAt: status === RequestStatus.SEARCHING ? getExpiryDate() : null,
        paymentStatus: "UNPAID",
        platformFeePercent: financials.platformFeePercent,
        platformFeeAmount: financials.platformFeeAmount,
        driverNetEarning: financials.driverNetEarning,
      },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, trip);
    if (status !== RequestStatus.SCHEDULED) await emitNewTripCreated(req, trip);

    return res.status(201).json({
      message: "Trip request created successfully",
      trip,
    });
  } catch (error) {
    console.error("createTripRequest error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function rateCompletedTrip(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;
    const tripId = String(req.params.id || "");
    const rating = Number(req.body?.rating);
    const feedback = typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";

    if (!customerId) return res.status(401).json({ message: "Unauthorized" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5." });
    }
    if (feedback.length > 1000) {
      return res.status(400).json({ message: "Feedback must be 1,000 characters or fewer." });
    }

    const trip = await prisma.transportRequest.findFirst({
      where: { id: tripId, customerId },
      select: { id: true, status: true, assignedDriverId: true },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found." });
    if (trip.status !== RequestStatus.DELIVERED || !trip.assignedDriverId) {
      return res.status(400).json({ message: "You can rate a trip after delivery is complete." });
    }

    const existingRating = await prisma.tripRating.findUnique({ where: { tripId } });
    if (existingRating) return res.status(409).json({ message: "You have already rated this delivery." });

    const createdRating = await prisma.tripRating.create({
      data: { tripId, customerId, driverId: trip.assignedDriverId, rating, feedback: feedback || null },
    });
    return res.status(201).json({ message: "Thanks for rating your delivery.", rating: createdRating });
  } catch (error) {
    console.error("rateCompletedTrip error:", error);
    return res.status(500).json({ message: "Unable to save your rating. Please try again." });
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
          status: RequestStatus.DELIVERED,
        },
      }),
      prisma.transportRequest.count({
        where: {
          customerId,
          status: RequestStatus.CANCELLED,
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
    const tripId = String(req.params.id || req.params.tripId || "");
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
    const tripId = String(req.params.id || req.params.tripId || "");
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

    if (driver.availability !== "ONLINE") {
      return res.status(409).json({ message: "Go online before accepting a delivery" });
    }
    if (!hasValidCoordinates(driver.currentLat, driver.currentLng) || !hasFreshDriverLocation(driver.lastLocationAt)) {
      return res.status(400).json({ message: `A fresh driver location is required (updated within ${DRIVER_LOCATION_MAX_AGE_MS / 60000} minutes).` });
    }

    const existingActiveTrip = await prisma.transportRequest.findFirst({
      where: {
        assignedDriverId: driver.id,
        status: { in: ACTIVE_DRIVER_TRIP_STATUSES },
      },
      select: { id: true },
    });

    if (existingActiveTrip) {
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

    if (!SEARCHABLE_TRIP_STATUSES.includes(foundTrip.status)) {
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

    const distanceToPickupKm = calculateDistanceKm(driver.currentLat!, driver.currentLng!, foundTrip.pickupLat, foundTrip.pickupLng);
    if (distanceToPickupKm > DRIVER_ACCEPT_RADIUS_KM) {
      return res.status(403).json({ message: "This delivery is outside your current service radius." });
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const claimed = await tx.transportRequest.updateMany({
        where: {
          id: tripId,
          status: { in: SEARCHABLE_TRIP_STATUSES },
          assignedDriverId: null,
        },
        data: {
          assignedDriverId: driver.id,
          status: RequestStatus.ACCEPTED,
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

    try {
      await createNotification({
        userId: updatedTrip.customerId,
        type: "trip_accepted",
        title: "Driver found",
        message: `${driver.user.fullName} accepted your trip and is preparing to move.`,
        tripId: updatedTrip.id,
      });
    } catch (notifyError) {
      console.error("accept notification failed:", notifyError);
    }

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
      RequestStatus.DRIVER_EN_ROUTE,
      RequestStatus.ARRIVED_PICKUP,
      RequestStatus.IN_TRANSIT,
      RequestStatus.ARRIVED_DROPOFF,
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

    // Full transition matrix including SCHEDULED
    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      REQUESTING: [RequestStatus.SEARCHING, RequestStatus.CANCELLED],
      SEARCHING: [RequestStatus.SEARCHING_DRIVER, RequestStatus.CANCELLED],
      SEARCHING_DRIVER: [
        RequestStatus.DRIVER_ASSIGNED,
        RequestStatus.CANCELLED,
      ],
      DRIVER_ASSIGNED: [RequestStatus.DRIVER_EN_ROUTE, RequestStatus.CANCELLED],
      ACCEPTED: [RequestStatus.DRIVER_EN_ROUTE, RequestStatus.CANCELLED],
      DRIVER_EN_ROUTE: [RequestStatus.ARRIVED_PICKUP, RequestStatus.CANCELLED],
      DRIVER_ARRIVED: [RequestStatus.PICKUP_CONFIRMED, RequestStatus.CANCELLED],
      ARRIVED_PICKUP: [RequestStatus.PICKUP_CONFIRMED, RequestStatus.CANCELLED],
      PICKUP_CONFIRMED: [RequestStatus.IN_TRANSIT, RequestStatus.CANCELLED],
      IN_TRANSIT: [RequestStatus.ARRIVED_DROPOFF, RequestStatus.CANCELLED],
      ARRIVED_DROPOFF: [
        RequestStatus.DELIVERY_CONFIRMED,
        RequestStatus.CANCELLED,
      ],
      DELIVERY_CONFIRMED: [
        RequestStatus.COMPLETED_PENDING_CONFIRMATION,
        RequestStatus.PAYMENT_PENDING,
        RequestStatus.CANCELLED,
      ],
      COMPLETED_PENDING_CONFIRMATION: [
        RequestStatus.COMPLETED,
        RequestStatus.PAYMENT_PENDING,
        RequestStatus.CANCELLED,
      ],
      COMPLETED: [],
      DELIVERED: [],
      PAYMENT_PENDING: [RequestStatus.COMPLETED, RequestStatus.CANCELLED],
      CANCELLED: [],
      SCHEDULED: [], // no manual transitions; cron will move to SEARCHING
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

    await notifyCustomerTripStatus({
      id: updatedTrip.id,
      customerId: updatedTrip.customerId,
      status: updatedTrip.status,
    });

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

    if (trip.status !== RequestStatus.ARRIVED_PICKUP) {
      return res.status(400).json({
        message: "Pickup can only be confirmed when driver has arrived",
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: { status: RequestStatus.PICKUP_CONFIRMED },
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
      include: {
        assignedDriver: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res.status(403).json({
        message: "You can only confirm delivery for your own trip",
      });
    }

    if (trip.status !== RequestStatus.ARRIVED_DROPOFF) {
      return res.status(400).json({
        message:
          "Delivery can only be confirmed when driver has arrived at drop-off",
      });
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportRequest.update({
        where: { id: tripId },
        data: { status: RequestStatus.DELIVERY_CONFIRMED },
        include: buildTripInclude(),
      });

      if (trip.assignedDriverId) {
        await tx.driverProfile.update({
          where: { id: trip.assignedDriverId },
          data: { availability: "ONLINE" },
        });
      }

      return updated;
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
    const { reason } = req.body;

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
      return res.status(403).json({
        message: "You can only cancel your own trip",
      });
    }

    // Allowed statuses: searching, accepted, en route, and scheduled
    const allowedStatuses: RequestStatus[] = [
      RequestStatus.SEARCHING,
      RequestStatus.ACCEPTED,
      RequestStatus.DRIVER_EN_ROUTE,
      RequestStatus.SCHEDULED, // <-- NEW
    ];
    if (!allowedStatuses.includes(trip.status)) {
      return res.status(400).json({
        message: `Cannot cancel trip in status ${trip.status}. Only before pickup.`,
      });
    }

    let cancellationFee = 0;
    if (
      trip.status === RequestStatus.ACCEPTED ||
      trip.status === RequestStatus.DRIVER_EN_ROUTE
    ) {
      cancellationFee = CANCELLATION_FEES.CUSTOMER[trip.status] || 0;
    }
    // For SCHEDULED, fee remains 0.

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const nextTrip = await tx.transportRequest.update({
        where: { id: tripId },
        data: {
          status: RequestStatus.CANCELLED,
          cancellationReason: reason || "Customer cancelled the trip",
          cancelledBy: "CUSTOMER",
          cancellationFee: cancellationFee,
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
        if (cancellationFee > 0) {
          console.log(
            `Driver ${trip.assignedDriverId} earned ${cancellationFee} KES cancellation fee`,
          );
        }
      }

      return nextTrip;
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${tripId}`).emit("trip_cancelled", {
        tripId: trip.id,
        cancelledBy: "CUSTOMER",
        reason: updatedTrip.cancellationReason,
        fee: cancellationFee,
      });
    }

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Trip cancelled successfully",
      trip: updatedTrip,
      fee: cancellationFee,
    });
  } catch (error) {
    console.error("cancelTripByCustomer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function cancelTripByDriver(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || req.params.tripId || "");
    const { reason } = req.body;

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

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: { assignedDriver: true },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assignedDriverId !== driver.id) {
      return res.status(403).json({
        message: "You are not assigned to this trip",
      });
    }

    // Driver can cancel only if they have accepted or are en route (not scheduled)
    const allowedStatuses: RequestStatus[] = [
      RequestStatus.ACCEPTED,
      RequestStatus.DRIVER_EN_ROUTE,
    ];
    if (!allowedStatuses.includes(trip.status)) {
      return res.status(400).json({
        message: `Cannot cancel trip in status ${trip.status}. Only before pickup.`,
      });
    }

    let penalty = 0;
    if (trip.status === RequestStatus.ACCEPTED) {
      penalty = CANCELLATION_FEES.DRIVER.ACCEPTED;
    } else if (trip.status === RequestStatus.DRIVER_EN_ROUTE) {
      penalty = CANCELLATION_FEES.DRIVER.DRIVER_EN_ROUTE;
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const nextTrip = await tx.transportRequest.update({
        where: { id: tripId },
        data: {
          status: RequestStatus.CANCELLED,
          cancellationReason: reason || "Driver cancelled the trip",
          cancelledBy: "DRIVER",
          cancellationFee: penalty,
          paymentStatus:
            trip.paymentStatus === "PAID" ? trip.paymentStatus : "FAILED",
        },
        include: buildTripInclude(),
      });

      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { availability: "ONLINE" },
      });

      if (penalty > 0) {
        console.log(
          `Driver ${driver.id} will be charged ${penalty} KES for cancellation`,
        );
      }

      return nextTrip;
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${tripId}`).emit("trip_cancelled", {
        tripId: trip.id,
        cancelledBy: "DRIVER",
        reason: updatedTrip.cancellationReason,
        fee: penalty,
      });
    }

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Trip cancelled by driver",
      trip: updatedTrip,
      penalty: penalty,
    });
  } catch (error) {
    console.error("cancelTripByDriver error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// ---------- CUSTOMER ACTIVE TRIP ----------
export async function getMyCustomerActiveTrip(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findFirst({
      where: {
        customerId,
        status: {
          in: ACTIVE_CUSTOMER_TRIP_STATUSES,
        },
      },
      orderBy: { updatedAt: "desc" },
      include: buildTripInclude(),
    });

    return res.json({ trip: trip ?? null });
  } catch (error) {
    console.error("getMyCustomerActiveTrip error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// ---------- DRIVER STARTS TRANSIT ----------
export async function confirmPickupConfirmedByDriver(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || req.params.tripId || "");

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

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: { assignedDriver: true },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assignedDriverId !== driver.id) {
      return res.status(403).json({
        message: "You are not assigned to this trip",
      });
    }

    if (trip.status !== RequestStatus.PICKUP_CONFIRMED) {
      return res.status(400).json({
        message: `Cannot start transit from status ${trip.status}. Pickup must be confirmed first.`,
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: { status: RequestStatus.IN_TRANSIT },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Transit started successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("confirmPickupConfirmedByDriver error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// ---------- NEW: GET SCHEDULED TRIPS ----------
export async function getMyScheduledTrips(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trips = await prisma.transportRequest.findMany({
      where: {
        customerId,
        status: RequestStatus.SCHEDULED,
        scheduledFor: {
          gte: new Date(),
        },
      },
      orderBy: { scheduledFor: "asc" },
      include: buildTripInclude(),
    });

    return res.json({ trips });
  } catch (error) {
    console.error("getMyScheduledTrips error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
