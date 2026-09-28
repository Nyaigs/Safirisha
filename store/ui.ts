import { create } from "zustand";

type UIState = {
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
}));
