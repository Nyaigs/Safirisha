import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LoadSize, VehicleId } from "../types";

export type VehicleItem = {
  id: VehicleId;
  name: string;
  capacity: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  supportedLoadSizes: LoadSize[];
};

export const VEHICLES: VehicleItem[] = [
  {
    id: "bike",
    name: "Motorbike",
    capacity: "Small parcels and light deliveries",
    icon: "motorbike",
    supportedLoadSizes: ["Small"],
  },
  {
    id: "tuktuk",
    name: "TukTuk",
    capacity: "Light cargo and compact loads",
    icon: "rickshaw",
    supportedLoadSizes: ["Small", "Medium"],
  },
  {
    id: "pickup",
    name: "Pickup",
    capacity: "Medium to large loads",
    icon: "car-pickup",
    supportedLoadSizes: ["Small", "Medium", "Large"],
  },
  {
    id: "lorry",
    name: "Lorry",
    capacity: "Heavy cargo and bulk transport",
    icon: "truck-outline",
    supportedLoadSizes: ["Medium", "Large"],
  },
];
