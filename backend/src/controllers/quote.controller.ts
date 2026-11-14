import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { createQuote, getValidQuote, type QuoteOutput } from "../services/quote.service";

export async function createQuoteController(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      vehicleType,
      loadSize,
      loadDescription,
      fragile,
      scheduledFor,
    } = req.body as {
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      dropoffAddress: string;
      dropoffLat: number;
      dropoffLng: number;
      vehicleType: string;
      loadSize: string;
      loadDescription?: string | null;
      fragile?: boolean;
      scheduledFor?: string;
    };

    // Validate required fields
    if (
      !pickupAddress ||
      pickupLat == null ||
      pickupLng == null ||
      !dropoffAddress ||
      dropoffLat == null ||
      dropoffLng == null ||
      !vehicleType ||
      !loadSize
    ) {
      return res.status(400).json({
        message:
          "pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, vehicleType, and loadSize are required",
      });
    }

    // Validate coordinates
    const coordinates = [pickupLat, pickupLng, dropoffLat, dropoffLng].map(Number);
    if (
      !coordinates.every(Number.isFinite) ||
      Math.abs(coordinates[0]) > 90 ||
      Math.abs(coordinates[2]) > 90 ||
      Math.abs(coordinates[1]) > 180 ||
      Math.abs(coordinates[3]) > 180
    ) {
      return res.status(400).json({ message: "Pickup and drop-off coordinates must be valid." });
    }

    // Optional: validate scheduledFor if provided
    if (scheduledFor) {
      const date = new Date(scheduledFor);
      const minimumScheduledTime = new Date(Date.now() + 15 * 60 * 1000);
      if (isNaN(date.getTime()) || date < minimumScheduledTime) {
        return res
          .status(400)
          .json({ message: "Scheduled pickup must be at least 15 minutes from now." });
      }
    }

    const quoteResult = await createQuote({
      customerId,
      pickupLat: coordinates[0],
      pickupLng: coordinates[1],
      dropoffLat: coordinates[2],
      dropoffLng: coordinates[3],
      vehicleType,
      loadSize,
      loadDescription,
      fragile,
    });

    return res.status(201).json({
      message: "Quote created successfully",
      quoteId: quoteResult.quoteId,
      total: quoteResult.total,
      breakdown: quoteResult.breakdown,
      expiresAt: quoteResult.expiresAt,
    });
  } catch (error: any) {
    console.error("createQuoteController error:", error);

    // Handle specific validation errors
    if (error.message.includes("not supported")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("different locations")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Server error" });
  }
}

export async function getQuoteController(req: AuthRequest, res: Response) {
  try {
    const customerId = req.user?.id;
    const quoteId = Array.isArray(req.params.quoteId) ? req.params.quoteId[0] : req.params.quoteId;

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!quoteId) {
      return res.status(400).json({ message: "Quote ID is required" });
    }

    const quote = await getValidQuote(quoteId, customerId);

    if (!quote) {
      return res.status(404).json({ message: "Quote not found, expired, or already used" });
    }

    return res.json({ quote });
  } catch (error) {
    console.error("getQuoteController error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}