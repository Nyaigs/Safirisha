import { Router } from "express";
import multer from "multer";
import path from "path";
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "vehicleImage") {
      cb(null, path.join(process.cwd(), "uploads", "vehicles"));
    } else if (file.fieldname === "ownershipProof") {
      cb(null, path.join(process.cwd(), "uploads", "ownership"));
    } else {
      cb(null, path.join(process.cwd(), "uploads", "misc"));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

router.use(authenticate);
router.use(authorizeRoles("DRIVER"));

router.get("/me", getMyDriverProfile);
router.get("/me/active-trip", getMyActiveTrip);
router.get("/me/nearby-trips", getNearbyTripRequests);

router.patch("/me/availability", updateDriverAvailability);
router.patch("/me/location", updateDriverLocation);

// KYC route with file upload
router.patch(
  "/me/kyc",
  upload.fields([
    { name: "vehicleImage", maxCount: 1 },
    { name: "ownershipProof", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
  ]),
  updateDriverKyc,
);

router.post("/go-online", goOnline);
router.post("/go-offline", goOffline);

router.post("/trips/:tripId/accept", acceptTripRequest);

export default router;
