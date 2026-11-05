import { Router } from "express";
import { getNearbyDriversForMap } from "../controllers/map.controller";

const router = Router();
router.get("/nearby-drivers", getNearbyDriversForMap);
export default router;
