import { prisma } from "../lib/prisma";

export async function processScheduledTrips() {
  const now = new Date();
  const bufferMinutes = 15; // Start searching 15 mins before pickup
  const cutoff = new Date(now.getTime() + bufferMinutes * 60000);

  try {
    const trips = await prisma.transportRequest.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: cutoff, // scheduled time is within the next 15 minutes
          gte: now, // not already past
        },
      },
    });

    for (const trip of trips) {
      await prisma.transportRequest.update({
        where: { id: trip.id },
        data: { status: "SEARCHING" },
      });
      console.log(`🕐 Scheduled trip ${trip.id} released for drivers.`);
    }
  } catch (error) {
    console.error("Error processing scheduled trips:", error);
  }
}
