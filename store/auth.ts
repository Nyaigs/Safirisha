import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { disconnectSocket, refreshSocketToken } from "../lib/socket";
import { setLegacyToken } from "../lib/auth-token";

export type DriverProfile = {
  id: string;
  plateNumber: string;
  vehicleType: string;
  vehicleImageUrl?: string;
  ownershipProofUrl?: string;
  approvalStatus?: string;
  availability?: string;
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
};

export type User = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
  driverProfile?: DriverProfile | null;
};

export type AuthMode = "legacy" | "clerk" | null;

type AuthState = {
  user: User | null;
  token: string | null;
  authMode: AuthMode;
  hasHydrated: boolean;

  login: (user: User, token?: string | null, authMode?: AuthMode) => void;
  logout: () => void;

  setHasHydrated: (value: boolean) => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuthMode: (authMode: AuthMode) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      authMode: null,
      hasHydrated: false,

login: (user, token = null, authMode = "legacy") => {
        set({ user, token, authMode });
        if (authMode === "legacy") {
          setLegacyToken(token);
        }
        refreshSocketToken();
      },

      logout: () => {
        disconnectSocket();
        setLegacyToken(null);
        set({
          user: null,
          token: null,
          authMode: null,
        });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setUser: (user) => set({ user }),

      setToken: (token) => {
        set({ token });
        setLegacyToken(token);
      },

      setAuthMode: (authMode) => set({ authMode }),
    }),
    {
      name: "safirisha-auth",
      storage: createJSONStorage(() => AsyncStorage),

      partialize: (state) => ({
        user: state.user,
        token: state.token,
        authMode: state.authMode,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
