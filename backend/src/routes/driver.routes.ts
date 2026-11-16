import crypto from "crypto";
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

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

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
    // SECURITY (C-07): Ignore original filename completely. Use UUID.
    const ext = path.extname(path.basename(file.originalname)).toLowerCase();
    const uuid = crypto.randomUUID();
    cb(null, `${file.fieldname}-${uuid}${ext}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed"));
    }
    cb(null, true);
  }
});

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
