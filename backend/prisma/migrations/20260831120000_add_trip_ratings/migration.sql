-- A customer can leave one rating for a completed delivery.
CREATE TABLE "TripRating" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TripRating_tripId_key" ON "TripRating"("tripId");
CREATE INDEX "TripRating_customerId_idx" ON "TripRating"("customerId");
CREATE INDEX "TripRating_driverId_idx" ON "TripRating"("driverId");

ALTER TABLE "TripRating" ADD CONSTRAINT "TripRating_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripRating" ADD CONSTRAINT "TripRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripRating" ADD CONSTRAINT "TripRating_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
