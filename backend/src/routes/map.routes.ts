import { authenticate } from "../middleware/auth.middleware";
import { Router } from "express";
import { getNearbyDriversForMap } from "../controllers/map.controller";

const router = Router();
router.get("/nearby-drivers", authenticate, getNearbyDriversForMap);
export default router;
