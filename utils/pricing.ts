import { LoadSize, VehicleId } from "../types";

const MINUTES_PER_KM = 2.4;
const MIN_TRIP_MINUTES = 5;
const FRAGILE_MULTIPLIER = 1.15;
const MAX_SURGE = 1.5;

type VehicleRates = { base: number; perKm: number; perMin: number; minFare: number };

const VEHICLE_RATES: Record<VehicleId, VehicleRates> = {
  bike:   { base: 100,  perKm: 30,  perMin: 2,  minFare: 150 },
  tuktuk: { base: 200,  perKm: 45,  perMin: 4,  minFare: 300 },
  pickup: { base: 600,  perKm: 75,  perMin: 6,  minFare: 800 },
  lorry:  { base: 1500, perKm: 120, perMin: 10, minFare: 2000 },
};

const LOAD_MULTIPLIERS: Record<LoadSize, number> = {
  Small: 1.0,
  Medium: 1.3,
  Large: 1.7,
  "Extra Large": 2.2,
  Custom: 1.7,
};

export type SurgeInfo = { multiplier: number; reason: string | null };

export function getSurgeMultiplier(at: Date = new Date()): SurgeInfo {
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

export function estimateTripMinutes(distanceKm: number): number {
  return Math.max(MIN_TRIP_MINUTES, Math.round(distanceKm * MINUTES_PER_KM));
}

export function getPriceBreakdown(
  selectedVehicle: VehicleId | null,
  loadSize: LoadSize | null,
  distanceKm = 0,
  fragile = false,
  at: Date = new Date(),
): PriceBreakdown {
  const empty: PriceBreakdown = {
    baseFare: 0, distanceCharge: 0, timeCharge: 0, subtotal: 0,
    loadMultiplier: 1, loadAdjustment: 0,
    fragile: false, fragileAdjustment: 0,
    surgeMultiplier: 1, surgeAdjustment: 0, surgeReason: null,
    preFloorTotal: 0, total: 0, estimatedMinutes: 0, appliedMinFare: false,
  };
  if (!selectedVehicle || !loadSize) return empty;
  const rates = VEHICLE_RATES[selectedVehicle];
  const loadMult = LOAD_MULTIPLIERS[loadSize];
  if (!rates || loadMult === undefined) return empty;
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

export function estimatePrice(
  selectedVehicle: VehicleId | null,
  loadSize: LoadSize | null,
  distanceKm = 0,
  fragile = false,
  at: Date = new Date(),
): number {
  return getPriceBreakdown(selectedVehicle, loadSize, distanceKm, fragile, at).total;
}
