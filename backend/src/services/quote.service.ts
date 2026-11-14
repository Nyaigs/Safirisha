import { prisma } from "../lib/prisma";
import {
  getPriceBreakdownWithRates,
  type PriceBreakdownWithRates,
} from "./trip-pricing.service";
import { calculateTripEarnings, DEFAULT_PLATFORM_FEE_PERCENT } from "./earnings.service";

const QUOTE_TTL_MINUTES = 5;

export type QuoteInput = {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  loadSize: string;
  loadDescription?: string | null;
  fragile?: boolean;
  customerId: string;
};

export type QuoteOutput = {
  quoteId: string;
  total: number;
  breakdown: PriceBreakdownWithRates;
  expiresAt: Date;
};

export async function createQuote(input: QuoteInput): Promise<QuoteOutput> {
  const {
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    vehicleType,
    loadSize,
    loadDescription,
    fragile = false,
    customerId,
  } = input;

  const normalizedVehicleType = normalizeVehicleType(vehicleType);
  const normalizedLoadSize = normalizeLoadSize(loadSize);

  // Calculate distance
  const distanceKm = calculateDistanceKm(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  );

  if (distanceKm <= 0) {
    throw new Error("Pickup and drop-off must be different locations.");
  }

  // Get price breakdown with rates
  const breakdown = getPriceBreakdownWithRates(
    normalizedVehicleType,
    normalizedLoadSize,
    distanceKm,
    fragile,
  );

  if (!breakdown) {
    throw new Error("The selected vehicle or load size is not supported.");
  }

  // Validate vehicle-load compatibility
  if (!isVehicleSuitableForLoad(normalizedVehicleType, normalizedLoadSize)) {
    throw new Error("The selected vehicle or load size is not supported.");
  }

  // Calculate financials using the locked total
  const financials = calculateTripEarnings(
    breakdown.total,
    DEFAULT_PLATFORM_FEE_PERCENT,
  );

  // Create quote with 5-minute expiry
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000);

  const quote = await prisma.quote.create({
    data: {
      customerId,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      vehicleType: normalizedVehicleType,
      loadSize: normalizedLoadSize,
      loadDescription: loadDescription?.trim() || null,
      distanceKm,
      baseFare: breakdown.base,
      perKmRate: breakdown.perKm,
      perMinRate: breakdown.perMin,
      estimatedMinutes: breakdown.estimatedMinutes,
      loadMultiplier: breakdown.loadMultiplier,
      fragileMultiplier: fragile ? 1.15 : 1.0,
      surgeMultiplier: breakdown.surgeMultiplier,
      surgeReason: breakdown.surgeReason,
      subtotal: breakdown.subtotal,
      total: breakdown.total,
      minFareApplied: breakdown.appliedMinFare,
      platformFeePercent: financials.platformFeePercent,
      platformFeeAmount: financials.platformFeeAmount,
      driverNetEarning: financials.driverNetEarning,
      expiresAt,
      status: "ACTIVE",
    },
  });

  return {
    quoteId: quote.id,
    total: breakdown.total,
    breakdown,
    expiresAt,
  };
}

export async function getValidQuote(
  quoteId: string,
  customerId: string,
): Promise<{
  id: string;
  total: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  driverNetEarning: number;
  vehicleType: string;
  loadSize: string;
  distanceKm: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  loadDescription: string | null;
  expiresAt: Date;
} | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
  });

  if (!quote) return null;
  if (quote.customerId !== customerId) return null;
  if (quote.status !== "ACTIVE") return null;
  if (quote.expiresAt < new Date()) return null;

  return quote;
}

export async function markQuoteUsed(quoteId: string): Promise<void> {
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: "USED",
      usedAt: new Date(),
    },
  });
}

export async function cleanupExpiredQuotes(): Promise<number> {
  const result = await prisma.quote.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: new Date() },
    },
    data: {
      status: "EXPIRED",
    },
  });
  return result.count;
}

// Helper functions (copied from trip controller for normalization)
function normalizeVehicleType(value: string): string {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const aliases: Record<string, string> = {
    BIKE: "BIKE",
    MOTORBIKE: "BIKE",
    BODA: "BIKE",
    TUKTUK: "TUKTUK",
    TUK_TUK: "TUKTUK",
    TUK: "TUKTUK",
    PICKUP: "PICKUP",
    PICK_UP: "PICKUP",
    LORRY: "MEDIUM_LORRY",
    MEDIUM_LORRY: "MEDIUM_LORRY",
    MEDIUMLORRY: "MEDIUM_LORRY",
    LARGE_TRUCK: "LARGE_TRUCK",
    LARGETRUCK: "LARGE_TRUCK",
    TRUCK: "LARGE_TRUCK",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeLoadSize(value: string): string {
  return String(value).trim().toUpperCase().replace(/\s+/g, "_");
}

function isVehicleSuitableForLoad(vehicleType: string, loadSize: string): boolean {
  const VEHICLE_LOAD_SIZES: Record<string, string[]> = {
    BIKE: ["SMALL"],
    TUKTUK: ["SMALL", "MEDIUM"],
    PICKUP: ["SMALL", "MEDIUM", "LARGE", "CUSTOM"],
    MEDIUM_LORRY: ["MEDIUM", "LARGE", "EXTRA_LARGE", "CUSTOM"],
    LARGE_TRUCK: ["MEDIUM", "LARGE", "EXTRA_LARGE", "CUSTOM"],
  };
  const normalizedLoad = loadSize.trim().toUpperCase().replace(/\s+/g, "_");
  return VEHICLE_LOAD_SIZES[vehicleType]?.includes(normalizedLoad) ?? false;
}

function calculateDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}