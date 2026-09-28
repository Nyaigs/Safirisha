import "dotenv/config";
import http from "http";
import cron from "node-cron";
import app from "./app";
import { prisma } from "./lib/prisma";
import { bootstrapSuperAdmin } from "./bootstrap";
import { processScheduledDeletions } from "./services/deletionworker";
import {
  expireStaleSearchingTrips,
  processScheduledTrips,
} from "./services/scheduledTripWorker";
import { initSocket } from "./socket/index";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  const server = http.createServer(app);

  const io = initSocket(server);

  //  CRITICAL FIX
  app.set("io", io);

  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("Running scheduled deletion worker...");
      await processScheduledDeletions();
    } catch (error: any) {
      if (error.code === "P1001") {
        console.log("Database asleep, skipping deletion worker...");
      } else {
        console.error("Deletion worker failed:", error);
      }
    }
  });

  cron.schedule("*/2 * * * *", async () => {
    try {
      // Skip DB work entirely if there are no active trips or scheduled trips
      const activeCount = await prisma.transportRequest.count({
        where: {
          status: {
            in: [
              "SEARCHING",
              "SEARCHING_DRIVER",
              "ACCEPTED",
              "DRIVER_EN_ROUTE",
              "DRIVER_ARRIVED",
              "ARRIVED_PICKUP",
              "PICKUP_CONFIRMED",
              "IN_TRANSIT",
              "ARRIVED_DROPOFF",
              "DELIVERY_CONFIRMED",
              "SCHEDULED",
            ],
          },
        },
      });
      if (activeCount === 0) return;

      await Promise.all([processScheduledTrips(io), expireStaleSearchingTrips(io)]);
    } catch (error: any) {
      if (error.code === "P1001") {
        console.log("Database asleep, skipping trip worker...");
      } else {
        console.error("Trip worker failed:", error);
      }
    }
  });

  server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Safirisha backend running on port ${PORT}`);

    try {
      await bootstrapSuperAdmin();
      console.log("Startup checks completed");
    } catch (error) {
      console.error("Startup checks failed:", error);
    }
  });
}

startServer();
