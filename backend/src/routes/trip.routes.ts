import { Router } from "express";
import {
  acceptTripRequest,
  cancelTripByCustomer,
  completeTripAfterDeliveryConfirmation,
  confirmDeliveryByCustomer,
  confirmPickupByCustomer,
  createTripRequest,
  getMyDriverActiveTrip,
  getMyTripStats,
  getMyTrips,
  getTripById,
  updateTripStatus,
} from "../controllers/trip.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

router.post("/", authenticate, authorizeRoles("CUSTOMER"), createTripRequest);

router.get("/my-trips", authenticate, authorizeRoles("CUSTOMER"), getMyTrips);

router.get(
  "/my-stats",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getMyTripStats,
);

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

// kept only so old frontend won't crash hard
router.patch(
  "/:id/complete",
  authenticate,
  authorizeRoles("DRIVER"),
  completeTripAfterDeliveryConfirmation,
);

export default router;
