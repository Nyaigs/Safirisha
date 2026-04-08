import { Router } from "express";
import {
  createAdminManagedUser,
  getAdminDashboard,
  getAdminTripById,
  getAdminTrips,
  getAdminUserById,
  getAdminUsers,
  getDeletionRequests,
  getLiveDrivers,
  getPendingDrivers,
  reactivateUser,
  suspendUser,
  updateDeletionRequestStatus,
  updateDriverApproval,
} from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("ADMIN"),
  getAdminDashboard,
);

router.post(
  "/users",
  authenticate,
  authorizeRoles("ADMIN"),
  createAdminManagedUser,
);

router.get("/users", authenticate, authorizeRoles("ADMIN"), getAdminUsers);

router.get(
  "/users/:userId",
  authenticate,
  authorizeRoles("ADMIN"),
  getAdminUserById,
);

router.patch(
  "/users/:userId/suspend",
  authenticate,
  authorizeRoles("ADMIN"),
  suspendUser,
);

router.patch(
  "/users/:userId/reactivate",
  authenticate,
  authorizeRoles("ADMIN"),
  reactivateUser,
);

router.get("/trips", authenticate, authorizeRoles("ADMIN"), getAdminTrips);

router.get(
  "/trips/:tripId",
  authenticate,
  authorizeRoles("ADMIN"),
  getAdminTripById,
);

router.get(
  "/drivers/pending",
  authenticate,
  authorizeRoles("ADMIN"),
  getPendingDrivers,
);

router.get(
  "/drivers/live",
  authenticate,
  authorizeRoles("ADMIN"),
  getLiveDrivers,
);

router.patch(
  "/drivers/:driverId/approval",
  authenticate,
  authorizeRoles("ADMIN"),
  updateDriverApproval,
);

router.get(
  "/deletion-requests",
  authenticate,
  authorizeRoles("ADMIN"),
  getDeletionRequests,
);

router.patch(
  "/deletion-requests/:requestId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateDeletionRequestStatus,
);

export default router;
