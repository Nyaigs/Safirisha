import { create } from "zustand";
import { apiFetch } from "../lib/api";
import type { Trip } from "../types/trip";

type CustomerStats = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
};

type CustomerState = {
  activeTrip: Trip | null;
  recentTrips: Trip[];
  stats: CustomerStats;
  loadingActiveTrip: boolean;
  loadingTrips: boolean;
  error: string | null;

  fetchActiveTrip: () => Promise<void>;
  fetchRecentTrips: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setActiveTrip: (trip: Trip | null) => void;
  reset: () => void;
};

const ACTIVE_STATUSES = new Set([
  "SEARCHING", "ACCEPTED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP",
  "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING",
]);

export const useCustomerStore = create<CustomerState>()((set) => ({
  activeTrip: null,
  recentTrips: [],
  stats: { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 },
  loadingActiveTrip: false,
  loadingTrips: false,
  error: null,

  fetchActiveTrip: async () => {
    try {
      set({ loadingActiveTrip: true, error: null });
      const data = await apiFetch("/trips/my-active");
      const trip: Trip | null = data?.trip ?? null;
      set({ activeTrip: trip, loadingActiveTrip: false });
    } catch {
      try {
        const data = await apiFetch("/trips/my-trips");
        const trips: Trip[] = Array.isArray(data?.trips) ? data.trips : [];
        const active = trips.find((t) => ACTIVE_STATUSES.has(t.status)) ?? null;
        set({ activeTrip: active, loadingActiveTrip: false });
      } catch {
        set({ loadingActiveTrip: false });
      }
    }
  },

  fetchRecentTrips: async () => {
    try {
      set({ loadingTrips: true });
      const data = await apiFetch("/trips/my-trips");
      const trips: Trip[] = Array.isArray(data?.trips) ? data.trips : [];
      set({ recentTrips: trips.slice(0, 5), loadingTrips: false });
    } catch {
      set({ loadingTrips: false });
    }
  },

  fetchStats: async () => {
    try {
      const data = await apiFetch("/trips/my-stats");
      set({
        stats: {
          totalTrips: data?.totalTrips ?? 0,
          completedTrips: data?.completedTrips ?? 0,
          cancelledTrips: data?.cancelledTrips ?? 0,
        },
      });
    } catch {
      /* silent */
    }
  },

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  reset: () =>
    set({
      activeTrip: null,
      recentTrips: [],
      stats: { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 },
      loadingActiveTrip: false,
      loadingTrips: false,
      error: null,
    }),
}));
