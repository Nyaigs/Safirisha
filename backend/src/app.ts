import cors from "cors";
import express from "express";
import path from "path";

import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import driverRoutes from "./routes/driver.routes";
import paymentRoutes from "./routes/payment.routes";
import tripRoutes from "./routes/trip.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
