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
};

export const distanceRates: Record<VehicleId, number> = {
  bike: 20,
  tuktuk: 35,
  pickup: 50,
  lorry: 80,
};

export function estimatePrice(
  selectedVehicle: VehicleId | null,
  loadSize: LoadSize | null,
  distanceKm = 0,
) {
  if (!selectedVehicle || !loadSize) return 0;

  const base = vehicleBasePrices[selectedVehicle] ?? 0;
  const loadCharge = loadSizePrices[loadSize] ?? 0;
  const distanceCharge = Math.round(
    distanceKm * (distanceRates[selectedVehicle] ?? 0),
  );

  return base + loadCharge + distanceCharge;
}
