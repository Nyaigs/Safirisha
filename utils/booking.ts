import { AppLocation, LoadSize, LocationPoint, VehicleId } from "../types";

export type BookingStep = "idle" | "pickup" | "dropoff" | "details" | "load" | "vehicle" | "confirm";
export type DeliveryCategory = "Package" | "Documents" | "Shopping" | "Groceries" | "Electronics" | "Furniture" | "Food" | "Other";

export type BookingDraft = {
  step: BookingStep;
  pickup: LocationPoint | null;
  dropoff: LocationPoint | null;
  category: DeliveryCategory | null;
  description: string;
  notes: string;
  fragile: boolean;
  loadSize: LoadSize | null;
  vehicle: VehicleId | null;
};

export const INITIAL_BOOKING_DRAFT: BookingDraft = {
  step: "idle",
  pickup: null,
  dropoff: null,
  category: null,
  description: "",
  notes: "",
  fragile: false,
  loadSize: null,
  vehicle: null,
};

export function toLocationPoint(location: AppLocation): LocationPoint {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address || "Pinned location",
    placeId: location.placeId,
  };
}

/** Selecting or editing pickup never clears an independently chosen drop-off. */
export function choosePickupInDraft(draft: BookingDraft, location: AppLocation): BookingDraft {
  return { ...draft, pickup: toLocationPoint(location), vehicle: null, step: "dropoff" };
}

export function chooseDropoffInDraft(draft: BookingDraft, location: AppLocation): BookingDraft {
  return { ...draft, dropoff: toLocationPoint(location), vehicle: null, step: "details" };
}

const PREVIOUS_STEP: Partial<Record<BookingStep, BookingStep>> = {
  dropoff: "pickup",
  details: "dropoff",
  load: "details",
  vehicle: "load",
  confirm: "vehicle",
};

export function previousBookingStep(current: BookingStep): BookingStep {
  return PREVIOUS_STEP[current] ?? "idle";
}

export function buildLoadDescription(
  category: DeliveryCategory | null,
  description: string,
  fragile: boolean,
): string | null {
  return [category, description.trim(), fragile ? "Fragile" : ""].filter(Boolean).join(" · ") || null;
}

export function hasValidLoadDescription(loadSize: LoadSize | null, description: string): boolean {
  return loadSize !== "Custom" || description.trim().length > 0;
}

export function distanceBetweenKm(from: LocationPoint, to: LocationPoint): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLng = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export type TripRequestDraft = {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  loadDescription: string | null;
  loadSize: string;
  specialNotes: string | null;
  estimatedPrice: number;
  distanceKm: number;
};

export function buildRequestPayload(
  draft: BookingDraft,
  selectedVehicle: VehicleId | null,
  distanceKm: number,
  estimatedPrice: number,
): TripRequestDraft | null {
  const { pickup, dropoff, loadSize } = draft;
  if (!pickup || !dropoff || !selectedVehicle || !loadSize || distanceKm <= 0) return null;
  if (!hasValidLoadDescription(loadSize, draft.description)) return null;
  return {
    pickupAddress: pickup.address,
    pickupLat: pickup.latitude,
    pickupLng: pickup.longitude,
    dropoffAddress: dropoff.address,
    dropoffLat: dropoff.latitude,
    dropoffLng: dropoff.longitude,
    vehicleType: selectedVehicle,
    loadDescription: buildLoadDescription(draft.category, draft.description, draft.fragile),
    loadSize,
    specialNotes: draft.notes.trim() || null,
    estimatedPrice,
    distanceKm,
  };
}
