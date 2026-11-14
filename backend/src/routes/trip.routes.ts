import { Router } from "express";
import {
  acceptTripRequest,
  cancelTripByCustomer,
  cancelTripByDriver,
  completeTripAfterDeliveryConfirmation,
  confirmDeliveryByCustomer,
  confirmPickupByCustomer,
  confirmPickupConfirmedByDriver,
  createTripRequest,
  getMyCustomerActiveTrip,
  getMyDriverActiveTrip,
  getMyScheduledTrips,
  getMyTripStats,
  getMyTrips,
  getTripById,
  rateCompletedTrip,
  updateTripStatus,
} from "../controllers/trip.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/zod.middleware";
import { z } from "zod";
import quoteRoutes from "./quote.routes";

const router = Router();

const createTripSchema = z.object({
  body: z.object({
    pickupAddress: z.string().min(1),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropoffAddress: z.string().min(1),
    dropoffLat: z.number().min(-90).max(90),
    dropoffLng: z.number().min(-180).max(180),
    vehicleType: z.string().min(1),
    loadSize: z.string().min(1),
    // Optional when using quoteId
    estimatedPrice: z.number().positive().optional(),
    distanceKm: z.number().positive().optional(),
    // Quote ID for locked pricing
    quoteId: z.string().optional().nullable(),
    loadDescription: z.string().optional().nullable(),
    specialNotes: z.string().optional().nullable(),
    scheduledFor: z.string().datetime().optional().nullable(),
    paymentMethod: z.enum(["CASH", "MPESA"]).optional().nullable(),
    senderName: z.string().optional().nullable(),
    senderPhone: z.string().optional().nullable(),
    recipientName: z.string().optional().nullable(),
    recipientPhone: z.string().optional().nullable(),
  }),
}).refine(
  (data) => {
    // Either quoteId OR (estimatedPrice AND distanceKm) must be provided
    const hasQuote = !!data.body.quoteId;
    const hasLegacyPricing = !!data.body.estimatedPrice && !!data.body.distanceKm;
    return hasQuote !== hasLegacyPricing; // XOR - exactly one must be true
  },
  {
    message: "Either quoteId OR (estimatedPrice AND distanceKm) must be provided, but not both",
    path: ["quoteId"],
  },
);

router.use("/quote", quoteRoutes);

router.post("/", authenticate, authorizeRoles("CUSTOMER"), validate(createTripSchema), createTripRequest);

router.get("/my-trips", authenticate, authorizeRoles("CUSTOMER"), getMyTrips);

router.get(
  "/my-stats",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getMyTripStats,
);

router.get(
  "/my-active",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getMyCustomerActiveTrip,
);

router.get(
  "/my-scheduled",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getMyScheduledTrips,
);

router.post("/:id/rating", authenticate, authorizeRoles("CUSTOMER"), rateCompletedTrip);

router.get(
  "/my-active-driver",
  authenticate,
  authorizeRoles("DRIVER"),
  getMyDriverActiveTrip,
);

router.get("/:id", authenticate, getTripById);

router.patch(
  "/:id/cancel",
  authenticate,
  authorizeRoles("CUSTOMER"),
  cancelTripByCustomer,
);

router.patch(
  "/:id/cancel/driver",
  authenticate,
  authorizeRoles("DRIVER"),
  cancelTripByDriver,
);

router.patch(
  "/:id/confirm-pickup",
  authenticate,
  authorizeRoles("CUSTOMER"),
  confirmPickupByCustomer,
);

router.patch(
  "/:id/confirm-delivery",
  authenticate,
  authorizeRoles("CUSTOMER"),
  confirmDeliveryByCustomer,
);

router.post(
  "/:id/accept",
  authenticate,
  authorizeRoles("DRIVER"),
  acceptTripRequest,
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("DRIVER"),
  updateTripStatus,
);

router.patch(
  "/:id/start-transit",
  authenticate,
  authorizeRoles("DRIVER"),
  confirmPickupConfirmedByDriver,
);

router.patch(
  "/:id/complete",
  authenticate,
  authorizeRoles("DRIVER"),
  completeTripAfterDeliveryConfirmation,
);

export default router;