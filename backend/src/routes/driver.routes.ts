import { Router } from "express";
import {
  acceptTrip,
  getMyActiveTrip,
  getMyDriverProfile,
  getNearbyTripRequests,
  goOffline,
  goOnline,
  updateDriverAvailability,
  updateDriverLocation,
} from "../controllers/driver.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("DRIVER"));

router.get("/me", getMyDriverProfile);
router.get("/me/active-trip", getMyActiveTrip);
router.get("/me/nearby-trips", getNearbyTripRequests);

router.patch("/me/availability", updateDriverAvailability);
router.patch("/me/location", updateDriverLocation);

router.post("/go-online", goOnline);
router.post("/go-offline", goOffline);

router.post("/trips/:tripId/accept", acceptTrip);

export default router;
