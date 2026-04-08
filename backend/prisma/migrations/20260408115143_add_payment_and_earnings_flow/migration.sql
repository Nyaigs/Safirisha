-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "TransportRequest" ADD COLUMN     "cashConfirmedByDriver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "driverNetEarning" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mpesaCheckoutRequestId" TEXT,
ADD COLUMN     "mpesaReceiptNumber" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "platformFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- CreateIndex
CREATE INDEX "TransportRequest_paymentStatus_idx" ON "TransportRequest"("paymentStatus");

-- CreateIndex
CREATE INDEX "TransportRequest_paymentMethod_idx" ON "TransportRequest"("paymentMethod");
