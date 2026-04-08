import { Router } from "express";
import {
  createDriverDeletionRequest,
  getMyActiveTrip,
  getMyDriverDeletionRequests,
  getMyDriverProfile,
  getNearbyTripRequests,
  updateDriverAvailability,
  updateDriverKyc,
  updateDriverLocation,
} from "../controllers/driver.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { driverDocsUpload } from "../middleware/upload.middleware";

const router = Router();

router.get("/me", authenticate, authorizeRoles("DRIVER"), getMyDriverProfile);

router.patch(
  "/me/kyc",
  authenticate,
  authorizeRoles("DRIVER"),
  driverDocsUpload.fields([
    { name: "vehicleImage", maxCount: 1 },
    { name: "ownershipProof", maxCount: 1 },
  ]),
  updateDriverKyc,
);

router.get(
  "/me/active-trip",
  authenticate,
  authorizeRoles("DRIVER"),
  getMyActiveTrip,
);

router.patch(
  "/me/availability",
  authenticate,
  authorizeRoles("DRIVER"),
  updateDriverAvailability,
);

router.patch(
  "/me/location",
  authenticate,
  authorizeRoles("DRIVER"),
  updateDriverLocation,
);

router.get(
  "/me/nearby-trips",
  authenticate,
  authorizeRoles("DRIVER"),
  getNearbyTripRequests,
);

router.post(
  "/me/deletion-request",
  authenticate,
  authorizeRoles("DRIVER"),
  createDriverDeletionRequest,
);

router.get(
  "/me/deletion-request",
  authenticate,
  authorizeRoles("DRIVER"),
  getMyDriverDeletionRequests,
);

export default router;
