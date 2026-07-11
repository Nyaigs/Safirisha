import { create } from "zustand";
import { apiFetch } from "../lib/api";

export type EarningsTrip = {
  id: string;
  estimatedPrice: number;
  driverNetEarning: number;
  platformFeeAmount: number;
  platformFeePercent: number;
  paymentMethod: string | null;
  paymentStatus: string;
  updatedAt: string;
  pickupAddress: string;
  dropoffAddress: string;
};

export type EarningsTotals = {
  gross: number;
  net: number;
  fees: number;
  tripCount: number;
};

type EarningsState = {
  totals: EarningsTotals;
  trips: EarningsTrip[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  fetchEarnings: (mode?: "initial" | "refresh") => Promise<void>;
  reset: () => void;
};

const INITIAL_TOTALS: EarningsTotals = {
  gross: 0,
  net: 0,
  fees: 0,
  tripCount: 0,
};

export const useEarningsStore = create<EarningsState>()((set) => ({
  totals: INITIAL_TOTALS,
  trips: [],
  isLoading: true,
  isRefreshing: false,
  error: null,

  fetchEarnings: async (mode = "initial") => {
    try {
      if (mode === "initial") set({ isLoading: true, error: null });
      if (mode === "refresh") set({ isRefreshing: true, error: null });

      const res = await apiFetch("/payments/driver/earnings");

      set({
        totals: {
          gross: res?.totals?.gross ?? 0,
          net: res?.totals?.net ?? 0,
          fees: res?.totals?.fees ?? 0,
          tripCount: res?.totals?.tripCount ?? 0,
        },
        trips: Array.isArray(res?.trips) ? res.trips : [],
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        isRefreshing: false,
        error: err?.message ?? "Failed to load earnings",
      });
    }
  },

  reset: () =>
    set({
      totals: INITIAL_TOTALS,
      trips: [],
      isLoading: true,
      isRefreshing: false,
      error: null,
    }),
}));
