import { Router } from "express";
import {
  clerkBootstrap,
  getMe,
  login,
  registerCustomer,
  registerDriver,
  requestPasswordReset,
  resetPasswordWithCode,
  updateMe,
  verifyPasswordResetCode,
} from "../controllers/auth.controller";
import {
  authenticate,
  authenticateIdentity,
} from "../middleware/auth.middleware";

const router = Router();

router.post("/register/customer", registerCustomer);
router.post("/register/driver", registerDriver);
router.post("/login", login);

router.post("/clerk/bootstrap", authenticateIdentity, clerkBootstrap);

router.post("/forgot-password", requestPasswordReset);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.post("/reset-password", resetPasswordWithCode);

router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);

export default router;
