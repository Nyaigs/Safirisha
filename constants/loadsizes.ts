import { LoadSize } from "../types";

export type LoadSizeOption = {
  key: LoadSize;
  label: string;
  weightRange: string;
  description: string;
  recommendedVehicles: string[];
};

export const LOAD_SIZE_OPTIONS: LoadSizeOption[] = [
  {
    key: "Small",
    label: "Small Load",
    weightRange: "0 - 100 kg",
    description:
      "Best for parcels, groceries, a few boxes, suitcase moves, or light shop stock.",
    recommendedVehicles: ["Motorbike", "TukTuk"],
  },
  {
    key: "Medium",
    label: "Medium Load",
    weightRange: "100 - 500 kg",
    description:
      "Good for multiple boxes, small appliances, electronics, and medium stock movement.",
    recommendedVehicles: ["TukTuk", "Pickup"],
  },
  {
    key: "Large",
    label: "Large Load",
    weightRange: "500 - 1500 kg",
    description:
      "Suitable for furniture, larger deliveries, business stock, and relocation items.",
    recommendedVehicles: ["Pickup", "Lorry"],
  },
];

export function getLoadSizeByKey(key?: string | null) {
  return LOAD_SIZE_OPTIONS.find((item) => item.key === key) ?? null;
}
