import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "path";

import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/error.middleware";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import driverRoutes from "./routes/driver.routes";
import notificationRoutes from "./routes/notification.routes";
import paymentRoutes from "./routes/payment.routes";
import tripRoutes from "./routes/trip.routes";
import userRoutes from "./routes/user.routes";

const app = express();

// Set CORS_ALLOWED_ORIGINS to comma-separated trusted web origins. Development
// falls back to the local Expo web origins below; production fails closed if unset.
// Native clients omit Origin and remain allowed.
const developmentOrigins = ["http://localhost:8081", "http://localhost:19006"];
const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins?.length
  ? configuredOrigins
  : process.env.NODE_ENV === "production"
    ? []
    : developmentOrigins;

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 900, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/payments", paymentRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, message: "Safirisha API healthy" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Safirisha API healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

// DB ping endpoint – keeps Neon awake
app.get("/api/db-ping", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, message: "Database connection healthy" });
  } catch (error) {
    console.error("Database connection error:", error);
    res
      .status(500)
      .json({ ok: false, message: "Database connection unavailable" });
  }
});

app.use(notFound);
app.use(errorHandler);

export default app;
