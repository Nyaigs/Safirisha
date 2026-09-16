import { Router } from "express";
import {
  getMyActiveTrip,
  getMyDriverProfile,
  getNearbyTripRequests,
  goOffline,
  goOnline,
  updateDriverAvailability,
  updateDriverKyc,
  updateDriverLocation,
} from "../controllers/driver.controller";
import { acceptTripRequest } from "../controllers/trip.controller";
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

// KYC route
router.patch("/me/kyc", updateDriverKyc);    

router.post("/go-online", goOnline);
router.post("/go-offline", goOffline);

router.post("/trips/:tripId/accept", acceptTripRequest);

export default router;
