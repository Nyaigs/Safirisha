import {
  calculateTripEarnings,
  DEFAULT_PLATFORM_FEE_PERCENT,
} from "./earnings.service";

const MINUTES_PER_KM = 2.4;
const MIN_TRIP_MINUTES = 5;
const FRAGILE_MULTIPLIER = 1.15;
const MAX_SURGE = 1.5;

type VehicleRates = { base: number; perKm: number; perMin: number; minFare: number };

const VEHICLE_RATES: Record<string, VehicleRates> = {
  BIKE:         { base: 100,  perKm: 30,  perMin: 2,  minFare: 150 },
  TUKTUK:       { base: 200,  perKm: 45,  perMin: 4,  minFare: 300 },
  PICKUP:       { base: 600,  perKm: 75,  perMin: 6,  minFare: 800 },
  MEDIUM_LORRY: { base: 1500, perKm: 120, perMin: 10, minFare: 2000 },
  LARGE_TRUCK:  { base: 1500, perKm: 120, perMin: 10, minFare: 2000 },
};

const LOAD_MULTIPLIERS: Record<string, number> = {
  SMALL: 1.0, MEDIUM: 1.3, LARGE: 1.7, EXTRA_LARGE: 2.2, CUSTOM: 1.7,
};

const VEHICLE_LOAD_SIZES: Record<string, string[]> = {
  BIKE: ["SMALL"],
  TUKTUK: ["SMALL", "MEDIUM"],
  PICKUP: ["SMALL", "MEDIUM", "LARGE", "CUSTOM"],
  MEDIUM_LORRY: ["MEDIUM", "LARGE", "EXTRA_LARGE", "CUSTOM"],
  LARGE_TRUCK: ["MEDIUM", "LARGE", "EXTRA_LARGE", "CUSTOM"],
};

export function isVehicleSuitableForLoad(vehicleType: string, loadSize: string) {
  return VEHICLE_LOAD_SIZES[vehicleType]?.includes(loadSize) ?? false;
}

export function estimateTripMinutes(distanceKm: number): number {
  return Math.max(MIN_TRIP_MINUTES, Math.round(distanceKm * MINUTES_PER_KM));
}

export function getSurgeMultiplier(at: Date = new Date()) {
  const hour = at.getHours();
  const day = at.getDay();
  const isWeekend = day === 0 || day === 6;
  let base = 1.0;
  let reason: string | null = null;
  if (hour >= 22 || hour < 6) { base = 1.35; reason = "Late night"; }
  else if (hour >= 6 && hour < 10) { base = 1.15; reason = "Morning peak"; }
  else if (hour >= 16 && hour < 20) { base = 1.20; reason = "Evening peak"; }
  if (isWeekend && base === 1.0) { base = 1.10; reason = "Weekend"; }
  else if (isWeekend) { base += 0.10; reason = `${reason} · Weekend`; }
  return { multiplier: Math.min(base, MAX_SURGE), reason };
}

export type PriceBreakdown = {
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  subtotal: number;
  loadMultiplier: number;
  loadAdjustment: number;
  fragile: boolean;
  fragileAdjustment: number;
  surgeMultiplier: number;
  surgeAdjustment: number;
  surgeReason: string | null;
  preFloorTotal: number;
  total: number;
  estimatedMinutes: number;
  appliedMinFare: boolean;
};

export function getPriceBreakdown(
  vehicleType: string,
  loadSize: string,
  distanceKm: number,
  fragile = false,
  at: Date = new Date(),
): PriceBreakdown | null {
  const rates = VEHICLE_RATES[vehicleType];
  const loadMult = LOAD_MULTIPLIERS[loadSize];
  if (!rates || loadMult === undefined) return null;

  const estimatedMinutes = estimateTripMinutes(distanceKm);
  const baseFare = rates.base;
  const distanceCharge = Math.round(distanceKm * rates.perKm);
  const timeCharge = estimatedMinutes * rates.perMin;
  const subtotal = baseFare + distanceCharge + timeCharge;

  const afterLoad = Math.round(subtotal * loadMult);
  const loadAdjustment = afterLoad - subtotal;

  const fragileMult = fragile ? FRAGILE_MULTIPLIER : 1;
  const afterFragile = Math.round(afterLoad * fragileMult);
  const fragileAdjustment = afterFragile - afterLoad;

  const { multiplier: surgeMultiplier, reason: surgeReason } = getSurgeMultiplier(at);
  const afterSurge = Math.round(afterFragile * surgeMultiplier);
  const surgeAdjustment = afterSurge - afterFragile;

  const appliedMinFare = afterSurge < rates.minFare;
  const total = Math.max(afterSurge, rates.minFare);

  return {
    baseFare, distanceCharge, timeCharge, subtotal,
    loadMultiplier: loadMult, loadAdjustment,
    fragile, fragileAdjustment,
    surgeMultiplier, surgeAdjustment, surgeReason,
    preFloorTotal: afterSurge, total, estimatedMinutes, appliedMinFare,
  };
}

export function calculateTripPrice(
  vehicleType: string,
  loadSize: string,
  distanceKm: number,
  fragile = false,
): number | null {
  const b = getPriceBreakdown(vehicleType, loadSize, distanceKm, fragile);
  return b ? b.total : null;
}

export function buildTripFinancials(estimatedPrice: number) {
  return calculateTripEarnings(estimatedPrice, DEFAULT_PLATFORM_FEE_PERCENT);
}
