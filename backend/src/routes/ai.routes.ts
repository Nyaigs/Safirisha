import { Router } from "express";
import { analyzeCargo } from "../controllers/ai.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
router.post("/analyze-cargo", authenticate, analyzeCargo);
export default router;
