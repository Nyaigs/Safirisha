import { LoadSize, VehicleId } from "../types";

export const vehicleBasePrices: Record<VehicleId, number> = {
  bike: 150,
  tuktuk: 300,
  pickup: 800,
  lorry: 1500,
};

export const loadSizePrices: Record<LoadSize, number> = {
  Small: 0,
  Medium: 200,
  Large: 500,
  "Extra Large": 900,
  Custom: 900,
};

export const distanceRates: Record<VehicleId, number> = {
  bike: 20,
  tuktuk: 35,
  pickup: 50,
  lorry: 80,
};

export type PriceBreakdown = {
  baseFare: number;
  loadAdjustment: number;
  distanceCharge: number;
  total: number;
};

export function getPriceBreakdown(
  selectedVehicle: VehicleId | null,
  loadSize: LoadSize | null,
  distanceKm = 0,
): PriceBreakdown {
  if (!selectedVehicle || !loadSize) {
    return { baseFare: 0, loadAdjustment: 0, distanceCharge: 0, total: 0 };
  }

  const baseFare = vehicleBasePrices[selectedVehicle] ?? 0;
  const loadAdjustment = loadSizePrices[loadSize] ?? 0;
  const distanceCharge = Math.round(
    distanceKm * (distanceRates[selectedVehicle] ?? 0),
  );

  return {
    baseFare,
    loadAdjustment,
    distanceCharge,
    total: baseFare + loadAdjustment + distanceCharge,
  };
}

export function estimatePrice(
  selectedVehicle: VehicleId | null,
  loadSize: LoadSize | null,
  distanceKm = 0,
) {
  return getPriceBreakdown(selectedVehicle, loadSize, distanceKm).total;
}
