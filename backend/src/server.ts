import "dotenv/config";
import http from "http";
import cron from "node-cron";
import app from "./app";
import { bootstrapSuperAdmin } from "./bootstrap";
import { processScheduledDeletions } from "./services/deletionworker";
import { initSocket } from "./socket/index";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  const server = http.createServer(app);

  const io = initSocket(server);

  //  CRITICAL FIX
  app.set("io", io);

  cron.schedule("*/5 * * * *", async () => {
    console.log("Running scheduled deletion worker...");
    await processScheduledDeletions();
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
