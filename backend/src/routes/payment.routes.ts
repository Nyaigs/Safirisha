import { Router } from "express";
import {
  choosePaymentMethod,
  confirmCashPaymentByDriver,
  getDriverEarningsSummary,
  initiateMpesaPayment,
} from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

router.patch(
  "/trips/:id/method",
  authenticate,
  authorizeRoles("CUSTOMER"),
  choosePaymentMethod,
);

router.post(
  "/trips/:id/mpesa/initiate",
  authenticate,
  authorizeRoles("CUSTOMER"),
  initiateMpesaPayment,
);

router.patch(
  "/trips/:id/cash/confirm",
  authenticate,
  authorizeRoles("DRIVER"),
  confirmCashPaymentByDriver,
);

router.get(
  "/driver/earnings",
  authenticate,
  authorizeRoles("DRIVER"),
  getDriverEarningsSummary,
);

export default router;
