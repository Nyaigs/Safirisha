import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiFetch } from "../lib/api";
import { connectSocket, getSocket } from "../lib/socket";
import type { Trip } from "../types/trip";

export type DriverStoreProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
  plateNumber: string | null;
  vehicleType: string | null;
  vehicleImageUrl: string | null;
  ownershipProofUrl: string | null;
  approvalStatus: string;
  availability: "ONLINE" | "OFFLINE" | "BUSY";
  currentLat: number | null;
  currentLng: number | null;
  currentHeading: number | null;
  currentSpeed: number | null;
  lastLocationAt: string | null;
  suspensionReason: string | null;
  isActive: boolean;
};

type DriverState = {
  isOnline: boolean;
  isConnectingSocket: boolean;
  isLoading: boolean;
  isToggling: boolean;
  error: string | null;
  driverProfile: DriverStoreProfile | null;
  activeTrip: Trip | null;

  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  setActiveTrip: (trip: Trip | null) => void;
  setDriverProfile: (profile: DriverStoreProfile | null) => void;
  setOnline: (value: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
  reset: () => void;
};

export const useDriverStore = create<DriverState>()(
  persist(
    (set, get) => ({
      isOnline: false,
      isConnectingSocket: false,
      isLoading: true,
      isToggling: false,
      error: null,
      driverProfile: null,
      activeTrip: null,

      initialize: async () => {
        try {
          set({ isLoading: true, error: null });

          const [profileRes, tripRes] = await Promise.all([
            apiFetch("/drivers/me"),
            apiFetch("/drivers/me/active-trip"),
          ]);

          const data = profileRes?.driver ?? profileRes ?? {};
          const activeTrip = tripRes?.trip ?? null;

          const profile: DriverStoreProfile = {
            id: data.id ?? "",
            fullName: data.fullName ?? "Driver",
            email: data.email ?? "",
            phone: data.phone ?? null,
            role: data.role ?? "DRIVER",
            plateNumber: data.plateNumber ?? null,
            vehicleType: data.vehicleType ?? null,
            vehicleImageUrl: data.vehicleImageUrl ?? null,
            ownershipProofUrl: data.ownershipProofUrl ?? null,
            approvalStatus: data.approvalStatus ?? "PENDING",
            availability: data.availability ?? "OFFLINE",
            currentLat: data.currentLat ?? null,
            currentLng: data.currentLng ?? null,
            currentHeading: data.currentHeading ?? null,
            currentSpeed: data.currentSpeed ?? null,
            lastLocationAt: data.lastLocationAt ?? null,
            suspensionReason: data.suspensionReason ?? null,
            isActive: data.isActive ?? true,
          };

          const isOnline =
            profile.availability === "ONLINE" ||
            profile.availability === "BUSY";

          set({
            driverProfile: profile,
            activeTrip,
            isOnline,
            isLoading: false,
          });

          if (isOnline) {
            const socket = connectSocket();
            socket.emit("driver:online");
          }
        } catch (err: any) {
          set({
            isLoading: false,
            error: err?.message ?? "Failed to load driver data",
          });
        }
      },

      goOnline: async () => {
        const prev = get().isOnline;
        set({ isOnline: true, isToggling: true, error: null });

        try {
          const socket = connectSocket();
          socket.emit("driver:online");

          await apiFetch("/drivers/me/availability", {
            method: "PATCH",
            body: { availability: "ONLINE" },
          });

          set((s) => ({
            isToggling: false,
            driverProfile: s.driverProfile
              ? { ...s.driverProfile, availability: "ONLINE" }
              : null,
          }));
        } catch (err: any) {
          set({ isOnline: prev, isToggling: false });
          throw err;
        }
      },

      goOffline: async () => {
        const prev = get().isOnline;
        set({ isOnline: false, isToggling: true, error: null });

        try {
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("driver:offline");
          }

          await apiFetch("/drivers/me/availability", {
            method: "PATCH",
            body: { availability: "OFFLINE" },
          });

          set((s) => ({
            isToggling: false,
            driverProfile: s.driverProfile
              ? { ...s.driverProfile, availability: "OFFLINE" }
              : null,
          }));
        } catch (err: any) {
          set({ isOnline: prev, isToggling: false });
          throw err;
        }
      },

      setActiveTrip: (trip) => set({ activeTrip: trip }),

      setDriverProfile: (profile) => set({ driverProfile: profile }),

      setOnline: (value) => set({ isOnline: value }),

      setError: (error) => set({ error }),

      reset: () =>
        set({
          isOnline: false,
          isConnectingSocket: false,
          isLoading: false,
          isToggling: false,
          error: null,
          driverProfile: null,
          activeTrip: null,
        }),
    }),
    {
      name: "safirisha-driver",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isOnline: state.isOnline,
      }),
    },
  ),
);
