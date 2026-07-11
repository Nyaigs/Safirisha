-- AlterTable
ALTER TABLE "TransportRequest" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "searchStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TransportRequest_expiresAt_idx" ON "TransportRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "TransportRequest_searchStartedAt_idx" ON "TransportRequest"("searchStartedAt");
