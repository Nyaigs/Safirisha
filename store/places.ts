import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppLocation } from "../types";

type PlacesState = {
  home: AppLocation | null;
  work: AppLocation | null;
  setHome: (place: AppLocation) => void;
  setWork: (place: AppLocation) => void;
};

export const usePlacesStore = create<PlacesState>()(
  persist(
    (set) => ({
      home: null,
      work: null,
      setHome: (place) => set({ home: place }),
      setWork: (place) => set({ work: place }),
    }),
    {
      name: "safirisha-saved-places",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
