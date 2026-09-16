import {
    calculateTripEarnings,
    DEFAULT_PLATFORM_FEE_PERCENT,
} from "./earnings.service";

const VEHICLE_PRICING: Record<string, { baseFare: number; distanceRate: number }> = {
  BIKE: { baseFare: 150, distanceRate: 20 },
  TUKTUK: { baseFare: 300, distanceRate: 35 },
  PICKUP: { baseFare: 800, distanceRate: 50 },
  MEDIUM_LORRY: { baseFare: 1500, distanceRate: 80 },
  LARGE_TRUCK: { baseFare: 1500, distanceRate: 80 },
};

const LOAD_ADJUSTMENTS: Record<string, number> = {
  SMALL: 0,
  MEDIUM: 200,
  LARGE: 500,
  EXTRA_LARGE: 900,
  CUSTOM: 900,
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

export function calculateTripPrice(
  vehicleType: string,
  loadSize: string,
  distanceKm: number,
) {
  const vehicle = VEHICLE_PRICING[vehicleType];
  const loadAdjustment = LOAD_ADJUSTMENTS[loadSize];
  if (!vehicle || loadAdjustment === undefined) return null;

  return vehicle.baseFare + loadAdjustment + Math.round(distanceKm * vehicle.distanceRate);
}

export function buildTripFinancials(estimatedPrice: number) {
  return calculateTripEarnings(estimatedPrice, DEFAULT_PLATFORM_FEE_PERCENT);
}
