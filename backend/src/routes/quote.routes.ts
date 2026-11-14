import { Router } from "express";
import { createQuoteController, getQuoteController } from "../controllers/quote.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { validate } from "../middleware/zod.middleware";
import { z } from "zod";

const router = Router();

const createQuoteSchema = z.object({
  body: z.object({
    pickupAddress: z.string().min(1),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropoffAddress: z.string().min(1),
    dropoffLat: z.number().min(-90).max(90),
    dropoffLng: z.number().min(-180).max(180),
    vehicleType: z.string().min(1),
    loadSize: z.string().min(1),
    loadDescription: z.string().optional().nullable(),
    fragile: z.boolean().optional().nullable(),
    scheduledFor: z.string().datetime().optional().nullable(),
  }),
});

router.post(
  "/",
  authenticate,
  authorizeRoles("CUSTOMER"),
  validate(createQuoteSchema),
  createQuoteController,
);

router.get(
  "/:quoteId",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getQuoteController,
);

export default router;