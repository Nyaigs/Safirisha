import { prisma } from "../lib/prisma";

/**
 * This worker checks for approved deletion requests that are due for execution
 * and deactivates the corresponding driver and user accounts.
 */
export async function processScheduledDeletions() {
  try {
    const now = new Date();

    // Find all approved deletion requests where scheduledDeletion <= now
    const requestsToDelete = await prisma.driverDeletionRequest.findMany({
      where: {
        status: "APPROVED",
        scheduledDeletion: {
          lte: now,
        },
      },
      include: {
        driver: true,
      },
    });

    for (const req of requestsToDelete) {
      // Deactivate user
      await prisma.user.update({
        where: { id: req.driver.userId },
        data: {
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: "Automatic deletion after admin approval",
        },
      });

      // Set driver availability offline
      await prisma.driverProfile.update({
        where: { id: req.driver.id },
        data: { availability: "OFFLINE" },
      });

      // Optional: mark deletion request as completed or remove it
      await prisma.driverDeletionRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED", // or add a "COMPLETED" enum if desired
          adminNote: "Account deleted automatically after 48 hours",
        },
      });

      console.log(`Driver ${req.driver.userId} deleted automatically.`);
    }
  } catch (err) {
    console.error("Error processing scheduled deletions:", err);
  }
}
