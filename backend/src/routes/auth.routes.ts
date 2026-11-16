import rateLimit from "express-rate-limit";
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

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many password reset attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});



router.post("/register/customer", registerCustomer);
router.post("/register/driver", registerDriver);
router.post("/login", login);

//Now valid
router.post("/clerk/bootstrap", authenticateIdentity, clerkBootstrap);

router.post("/forgot-password", resetLimiter, requestPasswordReset);
router.post("/verify-reset-code", resetLimiter, verifyPasswordResetCode);
router.post("/reset-password", resetLimiter, resetPasswordWithCode);

router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, updateMe);

export default router;
