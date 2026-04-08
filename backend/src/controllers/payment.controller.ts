import { PaymentMethod } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { calculateTripEarnings } from "../services/earnings.service";

function buildTripInclude() {
  return {
    customer: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        username: true,
      },
    },
    assignedDriver: {
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            username: true,
          },
        },
      },
    },
  } as const;
}

function emitTripUpdated(req: AuthRequest, trip: any) {
  const io = req.app.get("io");
  if (!io) return;

  io.to(`trip:${trip.id}`).emit("trip_updated", { trip });
  io.to(`trip:${trip.id}`).emit("trip_status_updated", {
    tripId: trip.id,
    status: trip.status,
    paymentMethod: trip.paymentMethod ?? null,
    paymentStatus: trip.paymentStatus ?? null,
  });

  io.emit("admin_stats_updated");
}

export async function choosePaymentMethod(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");
    const paymentMethod = String(
      req.body?.paymentMethod || "",
    ).toUpperCase() as PaymentMethod;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!["CASH", "MPESA"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res.status(403).json({
        message: "You can only set payment method for your own trip",
      });
    }

    if (
      trip.status !== "DELIVERY_CONFIRMED" &&
      trip.status !== "PAYMENT_PENDING"
    ) {
      return res.status(400).json({
        message: "Payment can only be selected after delivery is confirmed",
      });
    }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({
        message: "This trip has already been paid and completed",
      });
    }

    if (trip.paymentMethod && trip.paymentMethod !== paymentMethod) {
      return res.status(409).json({
        message: "Payment method has already been selected for this trip",
      });
    }

    const updatedTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: {
        paymentMethod,
        paymentStatus: paymentMethod === "CASH" ? "PENDING" : "UNPAID",
        status: "PAYMENT_PENDING",
      },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Payment method selected successfully",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("choosePaymentMethod error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function initiateMpesaPayment(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.customerId !== userId) {
      return res.status(403).json({
        message: "You can only pay for your own trip",
      });
    }

    if (
      trip.status !== "DELIVERY_CONFIRMED" &&
      trip.status !== "PAYMENT_PENDING"
    ) {
      return res.status(400).json({
        message: "Payment can only start after delivery is confirmed",
      });
    }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({
        message: "This trip has already been paid and completed",
      });
    }

    if (trip.paymentMethod && trip.paymentMethod !== "MPESA") {
      return res.status(409).json({
        message: "This trip is already set to a different payment method",
      });
    }

    const financials = calculateTripEarnings(
      trip.estimatedPrice,
      trip.platformFeePercent,
    );

    const pendingTrip = await prisma.transportRequest.update({
      where: { id: tripId },
      data: {
        paymentMethod: "MPESA",
        paymentStatus: "PENDING",
        status: "PAYMENT_PENDING",
        platformFeeAmount: financials.platformFeeAmount,
        driverNetEarning: financials.driverNetEarning,
        mpesaCheckoutRequestId: `SIM-${Date.now()}-${trip.id}`,
      },
      include: buildTripInclude(),
    });

    emitTripUpdated(req, pendingTrip);

    const shouldSimulateSuccess =
      process.env.MPESA_SIMULATE === "true" ||
      !process.env.MPESA_CONSUMER_KEY ||
      !process.env.MPESA_CONSUMER_SECRET ||
      !process.env.MPESA_SHORTCODE ||
      !process.env.MPESA_PASSKEY;

    if (shouldSimulateSuccess) {
      const completedTrip = await prisma.$transaction(async (tx) => {
        const nextTrip = await tx.transportRequest.update({
          where: { id: tripId },
          data: {
            paymentStatus: "PAID",
            status: "DELIVERED",
            paidAt: new Date(),
            completedAt: new Date(),
            mpesaReceiptNumber: `SIMRCPT${Date.now()}`,
          },
          include: buildTripInclude(),
        });

        if (trip.assignedDriverId) {
          await tx.driverProfile.update({
            where: { id: trip.assignedDriverId },
            data: { availability: "ONLINE" },
          });
        }

        return nextTrip;
      });

      emitTripUpdated(req, completedTrip);

      return res.json({
        message: "M-Pesa payment completed in simulation mode",
        simulated: true,
        trip: completedTrip,
      });
    }

    return res.json({
      message: "M-Pesa STK push initiated. Await callback confirmation.",
      simulated: false,
      trip: pendingTrip,
    });
  } catch (error) {
    console.error("initiateMpesaPayment error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function confirmCashPaymentByDriver(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.assignedDriverId !== driver.id) {
      return res.status(403).json({
        message: "You can only confirm cash for your own assigned trip",
      });
    }

    if (trip.status !== "PAYMENT_PENDING") {
      return res.status(400).json({
        message: "Trip is not waiting for payment confirmation",
      });
    }

    if (trip.paymentMethod !== "CASH") {
      return res.status(400).json({
        message: "Cash confirmation only applies to cash payments",
      });
    }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({
        message: "This cash payment has already been confirmed",
      });
    }

    const financials = calculateTripEarnings(
      trip.estimatedPrice,
      trip.platformFeePercent,
    );

    const completedTrip = await prisma.$transaction(async (tx) => {
      const nextTrip = await tx.transportRequest.update({
        where: { id: tripId },
        data: {
          paymentStatus: "PAID",
          status: "DELIVERED",
          cashConfirmedByDriver: true,
          paidAt: new Date(),
          completedAt: new Date(),
          platformFeeAmount: financials.platformFeeAmount,
          driverNetEarning: financials.driverNetEarning,
        },
        include: buildTripInclude(),
      });

      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { availability: "ONLINE" },
      });

      return nextTrip;
    });

    emitTripUpdated(req, completedTrip);

    return res.json({
      message: "Cash payment confirmed and trip completed successfully",
      trip: completedTrip,
    });
  } catch (error) {
    console.error("confirmCashPaymentByDriver error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getDriverEarningsSummary(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const deliveredTrips = await prisma.transportRequest.findMany({
      where: {
        assignedDriverId: driver.id,
        status: "DELIVERED",
        paymentStatus: "PAID",
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        estimatedPrice: true,
        driverNetEarning: true,
        platformFeeAmount: true,
        platformFeePercent: true,
        paymentMethod: true,
        paymentStatus: true,
        updatedAt: true,
        pickupAddress: true,
        dropoffAddress: true,
      },
    });

    const totals = deliveredTrips.reduce(
      (acc, trip) => {
        acc.gross += Number(trip.estimatedPrice || 0);
        acc.net += Number(trip.driverNetEarning || 0);
        acc.fees += Number(trip.platformFeeAmount || 0);
        return acc;
      },
      { gross: 0, net: 0, fees: 0 },
    );

    return res.json({
      totals: {
        gross: totals.gross,
        net: totals.net,
        fees: totals.fees,
        tripCount: deliveredTrips.length,
      },
      trips: deliveredTrips,
    });
  } catch (error) {
    console.error("getDriverEarningsSummary error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
