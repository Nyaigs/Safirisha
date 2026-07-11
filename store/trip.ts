import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { connectSocket, getSocket } from "../lib/socket";
import type { Trip, DriverLiveLocation } from "../types/trip";

export type TripRequestParams = {
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

export function validateTripRequestParams(params: TripRequestParams | null): string[] {
  if (!params) return ["No request data"];
  const missing: string[] = [];
  if (!params.pickupAddress) missing.push("pickupAddress");
  if (typeof params.pickupLat !== "number" || !isFinite(params.pickupLat)) missing.push("pickupLat");
  if (typeof params.pickupLng !== "number" || !isFinite(params.pickupLng)) missing.push("pickupLng");
  if (!params.dropoffAddress) missing.push("dropoffAddress");
  if (typeof params.dropoffLat !== "number" || !isFinite(params.dropoffLat)) missing.push("dropoffLat");
  if (typeof params.dropoffLng !== "number" || !isFinite(params.dropoffLng)) missing.push("dropoffLng");
  if (!params.vehicleType) missing.push("vehicleType");
  if (!params.loadSize) missing.push("loadSize");
  if (typeof params.estimatedPrice !== "number" || params.estimatedPrice <= 0) missing.push("estimatedPrice");
  if (typeof params.distanceKm !== "number" || params.distanceKm <= 0) missing.push("distanceKm");
  return missing;
}

type TripState = {
  currentRequest: TripRequestParams | null;
  currentTrip: Trip | null;
  driverLocation: DriverLiveLocation | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  setCurrentRequest: (params: TripRequestParams) => void;
  clearCurrentRequest: () => void;
  setCurrentTrip: (trip: Trip | null) => void;
  setDriverLocation: (location: DriverLiveLocation) => void;

  createTrip: () => Promise<string | null>;
  fetchTrip: (tripId: string) => Promise<void>;
  cancelTrip: (tripId: string) => Promise<void>;
  confirmPickup: (tripId: string) => Promise<void>;
  confirmDelivery: (tripId: string) => Promise<void>;
  updateTripStatus: (tripId: string, status: string) => Promise<void>;

  selectPaymentMethod: (tripId: string, method: string) => Promise<void>;
  initiateMpesa: (tripId: string) => Promise<void>;
  confirmCash: (tripId: string) => Promise<void>;

  subscribeToTripRoom: (tripId: string) => void;
  unsubscribeFromTripRoom: (tripId: string) => void;

  reset: () => void;
};

export const useTripStore = create<TripState>()((set, get) => ({
  currentRequest: null,
  currentTrip: null,
  driverLocation: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  setCurrentRequest: (params) => set({ currentRequest: params }),
  clearCurrentRequest: () => set({ currentRequest: null }),
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  setDriverLocation: (location) => set({ driverLocation: location }),

  createTrip: async () => {
    const request = get().currentRequest;
    const errors = validateTripRequestParams(request);
    if (errors.length > 0) {
      set({ error: `Invalid request: ${errors.join(", ")}`, isSubmitting: false });
      return null;
    }

    set({ isSubmitting: true, error: null });

    try {
      const res = await apiFetch("/trips", {
        method: "POST",
        body: {
          pickupAddress: request!.pickupAddress,
          pickupLat: request!.pickupLat,
          pickupLng: request!.pickupLng,
          dropoffAddress: request!.dropoffAddress,
          dropoffLat: request!.dropoffLat,
          dropoffLng: request!.dropoffLng,
          vehicleType: request!.vehicleType,
          loadDescription: request!.loadDescription,
          loadSize: request!.loadSize,
          specialNotes: request!.specialNotes,
          estimatedPrice: request!.estimatedPrice,
          distanceKm: request!.distanceKm,
        },
      });

      const trip: Trip | undefined = res?.trip;
      if (trip) {
        set({ currentTrip: trip, isSubmitting: false });
        return trip.id;
      }

      set({ isSubmitting: false });
      return null;
    } catch (err: any) {
      set({
        isSubmitting: false,
        error: err?.message ?? "Failed to create trip",
      });
      return null;
    }
  },

  fetchTrip: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch(`/trips/${tripId}`);
      const trip: Trip | undefined = res?.trip;
      if (trip) {
        set({ currentTrip: trip, isLoading: false });
      } else {
        set({ isLoading: false, error: "Trip not found" });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? "Failed to fetch trip" });
    }
  },

  cancelTrip: async (tripId) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/trips/${tripId}/cancel`, { method: "PATCH" });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to cancel trip" });
    }
  },

  confirmPickup: async (tripId) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/trips/${tripId}/confirm-pickup`, { method: "PATCH" });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to confirm pickup" });
    }
  },

  confirmDelivery: async (tripId) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/trips/${tripId}/confirm-delivery`, { method: "PATCH" });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to confirm delivery" });
    }
  },

  updateTripStatus: async (tripId, status) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/trips/${tripId}/status`, { method: "PATCH", body: { status } });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to update trip status" });
    }
  },

  selectPaymentMethod: async (tripId, method) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/payments/trips/${tripId}/method`, { method: "PATCH", body: { paymentMethod: method } });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to select payment method" });
    }
  },

  initiateMpesa: async (tripId) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/payments/trips/${tripId}/mpesa/initiate`, { method: "POST", body: {} });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to initiate M-Pesa payment" });
    }
  },

  confirmCash: async (tripId) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch(`/payments/trips/${tripId}/cash/confirm`, { method: "PATCH" });
      const trip: Trip | undefined = res?.trip;
      if (trip) set({ currentTrip: trip });
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ isSubmitting: false, error: err?.message ?? "Failed to confirm cash payment" });
    }
  },

  subscribeToTripRoom: (tripId) => {
    const socket = connectSocket();
    socket.emit("join_trip_room", tripId);
  },

  unsubscribeFromTripRoom: (tripId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("leave_trip_room", tripId);
    }
  },

  reset: () =>
    set({
      currentRequest: null,
      currentTrip: null,
      driverLocation: null,
      isLoading: false,
      isSubmitting: false,
      error: null,
    }),
}));
