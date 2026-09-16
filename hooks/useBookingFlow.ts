import { useCallback, useMemo, useState } from "react";
import { getLoadSizeByKey } from "../constants/loadsizes";
import { VEHICLES } from "../constants/vehicles";
import { AppLocation, LoadSize, LocationPoint, VehicleId } from "../types";
import { estimatePrice } from "../utils/pricing";

export type BookingStep = "idle" | "pickup" | "dropoff" | "details" | "load" | "vehicle" | "confirm";
export type DeliveryCategory = "Package" | "Documents" | "Shopping" | "Groceries" | "Electronics" | "Furniture" | "Food" | "Other";

const distanceBetween = (from: LocationPoint, to: LocationPoint) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLng = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

export function useBookingFlow() {
  const [step, setStep] = useState<BookingStep>("idle");
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [dropoff, setDropoff] = useState<LocationPoint | null>(null);
  const [category, setCategory] = useState<DeliveryCategory | null>(null);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [fragile, setFragile] = useState(false);
  const [loadSize, setLoadSize] = useState<LoadSize | null>(null);
  const [vehicle, setVehicle] = useState<VehicleId | null>(null);

  const distanceKm = useMemo(() => pickup && dropoff ? distanceBetween(pickup, dropoff) : 0, [pickup, dropoff]);
  const suitableVehicleIds = useMemo(() => {
    if (!loadSize) return [];
    const recommendedNames = getLoadSizeByKey(loadSize)?.recommendedVehicles ?? [];
    return VEHICLES.filter((vehicleItem) => recommendedNames.includes(vehicleItem.name)).map((vehicleItem) => vehicleItem.id);
  }, [loadSize]);
  const recommendedVehicle = suitableVehicleIds[0] ?? null;
  const selectedVehicle = vehicle ?? recommendedVehicle;
  const estimatedPrice = useMemo(() => estimatePrice(selectedVehicle, loadSize, distanceKm), [distanceKm, loadSize, selectedVehicle]);
  const etaMinutes = Math.max(5, Math.ceil(distanceKm * 3.5 + 6));

  const choosePickup = useCallback((location: AppLocation) => {
    setPickup({ latitude: location.latitude, longitude: location.longitude, address: location.address || "Pinned location", placeId: location.placeId });
    setDropoff(null);
    setVehicle(null);
    setStep("dropoff");
  }, []);
  const chooseDropoff = useCallback((location: AppLocation) => {
    setDropoff({ latitude: location.latitude, longitude: location.longitude, address: location.address || "Pinned location", placeId: location.placeId });
    setVehicle(null);
    setStep("details");
  }, []);
  const back = useCallback(() => setStep((current) => {
    const previous: Partial<Record<BookingStep, BookingStep>> = { dropoff: "pickup", details: "dropoff", load: "details", vehicle: "load", confirm: "vehicle" };
    return previous[current] || "idle";
  }), []);
  const hasValidLoadDescription = loadSize !== "Custom" || description.trim().length > 0;
  const requestPayload = useMemo(() => pickup && dropoff && selectedVehicle && loadSize && distanceKm > 0 && hasValidLoadDescription ? ({
    pickupAddress: pickup.address, pickupLat: pickup.latitude, pickupLng: pickup.longitude,
    dropoffAddress: dropoff.address, dropoffLat: dropoff.latitude, dropoffLng: dropoff.longitude,
    vehicleType: selectedVehicle, loadDescription: [category, description.trim(), fragile ? "Fragile" : ""].filter(Boolean).join(" · ") || null,
    loadSize, specialNotes: notes.trim() || null, estimatedPrice, distanceKm,
  }) : null, [category, description, distanceKm, dropoff, estimatedPrice, fragile, hasValidLoadDescription, loadSize, notes, pickup, selectedVehicle]);

  return { step, setStep, pickup, dropoff, category, setCategory, description, setDescription, notes, setNotes, fragile, setFragile, loadSize, setLoadSize, vehicle, setVehicle, selectedVehicle, recommendedVehicle, suitableVehicleIds, estimatedPrice, distanceKm, etaMinutes, choosePickup, chooseDropoff, back, requestPayload, loadSizeInfo: getLoadSizeByKey(loadSize), hasValidLoadDescription };
}
