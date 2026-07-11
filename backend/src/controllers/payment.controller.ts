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

// PAYMENT METHOD

export async function choosePaymentMethod(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");

    const paymentMethodRaw = String(
      req.body?.paymentMethod || "",
    ).toUpperCase();
    const paymentMethod = paymentMethodRaw as PaymentMethod;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.customerId !== userId) {
      return res.status(403).json({ message: "Not your trip" });
    }

     if (!["COMPLETED_PENDING_CONFIRMATION", "PAYMENT_PENDING"].includes(trip.status)) {
       return res.status(400).json({
         message: "Payment only allowed after delivery confirmation",
       });
     }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({ message: "Already paid" });
    }

    if (trip.paymentMethod && trip.paymentMethod !== paymentMethod) {
      return res.status(409).json({
        message: "Payment method already locked",
      });
    }

     const updatedTrip = await prisma.transportRequest.update({
       where: { id: tripId },
       data: {
         paymentMethod,
         paymentStatus: paymentMethod === "CASH" ? "PENDING" : "UNPAID",
         status: "COMPLETED_PENDING_CONFIRMATION",
       },
       include: buildTripInclude(),
     });

    emitTripUpdated(req, updatedTrip);

    return res.json({
      message: "Payment method selected",
      trip: updatedTrip,
    });
  } catch (error) {
    console.error("choosePaymentMethod error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

//Payment simulated

export async function initiateMpesaPayment(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.customerId !== userId) {
      return res.status(403).json({ message: "Not your trip" });
    }

    if (!["COMPLETED_PENDING_CONFIRMATION", "PAYMENT_PENDING"].includes(trip.status)) {
      return res.status(400).json({ message: "Invalid trip state" });
    }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({ message: "Already paid" });
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
         status: "COMPLETED_PENDING_CONFIRMATION",
         platformFeeAmount: financials.platformFeeAmount,
         driverNetEarning: financials.driverNetEarning,
         mpesaCheckoutRequestId: `SIM-${Date.now()}-${trip.id}`,
       },
       include: buildTripInclude(),
     });

    emitTripUpdated(req, pendingTrip);

    const simulate =
      process.env.MPESA_SIMULATE === "true" || !process.env.MPESA_CONSUMER_KEY;

    if (simulate) {
      const completedTrip = await prisma.$transaction(async (tx) => {
         const updated = await tx.transportRequest.update({
           where: { id: tripId },
           data: {
             paymentStatus: "PAID",
             status: "COMPLETED",
             paidAt: new Date(),
             completedAt: new Date(),
             mpesaReceiptNumber: `SIM-${Date.now()}`,
           },
          include: buildTripInclude(),
        });

        if (trip.assignedDriverId) {
          await tx.driverProfile.update({
            where: { id: trip.assignedDriverId },
            data: { availability: "ONLINE" },
          });
        }

        return updated;
      });

      emitTripUpdated(req, completedTrip);

      return res.json({
        message: "MPESA simulated success",
        simulated: true,
        trip: completedTrip,
      });
    }

    return res.json({
      message: "MPESA STK push initiated (mock)",
      simulated: false,
      trip: pendingTrip,
    });
  } catch (error) {
    console.error("initiateMpesaPayment error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// CASH CONFIRM

export async function confirmCashPaymentByDriver(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const tripId = String(req.params.id || "");

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) return res.status(404).json({ message: "No driver profile" });

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: buildTripInclude(),
    });

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.assignedDriverId !== driver.id) {
      return res.status(403).json({ message: "Not your trip" });
    }

    if (trip.paymentMethod !== "CASH") {
      return res.status(400).json({ message: "Not cash trip" });
    }

    if (trip.paymentStatus === "PAID") {
      return res.status(400).json({ message: "Already paid" });
    }

    const financials = calculateTripEarnings(
      trip.estimatedPrice,
      trip.platformFeePercent,
    );

    const completedTrip = await prisma.$transaction(async (tx) => {
         const updated = await tx.transportRequest.update({
           where: { id: tripId },
           data: {
             paymentStatus: "PAID",
             status: "COMPLETED",
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

      return updated;
    });

    emitTripUpdated(req, completedTrip);

    return res.json({
      message: "Cash confirmed",
      trip: completedTrip,
    });
  } catch (error) {
    console.error("confirmCashPaymentByDriver error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// EARNINGS

export async function getDriverEarningsSummary(
  req: AuthRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) return res.status(404).json({ message: "No driver" });

     const trips = await prisma.transportRequest.findMany({
       where: {
         assignedDriverId: driver.id,
         status: "COMPLETED",
         paymentStatus: "PAID",
       },
       orderBy: { updatedAt: "desc" },
     });

    const totals = trips.reduce(
      (acc, t) => {
        acc.gross += Number(t.estimatedPrice || 0);
        acc.net += Number(t.driverNetEarning || 0);
        acc.fees += Number(t.platformFeeAmount || 0);
        return acc;
      },
      { gross: 0, net: 0, fees: 0 },
    );

    return res.json({
      totals: {
        ...totals,
        tripCount: trips.length,
      },
      trips,
    });
  } catch (error) {
    console.error("earnings error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
