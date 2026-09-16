import { Platform } from "react-native";

/** Shared visual language for the Safirisha mobile experience. */
export const design = {
  colors: {
    brand: "#0D6B5D",
    brandDark: "#075246",
    brandSoft: "#E4F4EF",
    ink: "#12211E",
    muted: "#68746F",
    subtle: "#F4F7F5",
    surface: "#FFFFFF",
    border: "#DDE5E1",
    overlay: "rgba(11, 31, 26, 0.48)",
    success: "#16835D",
    successSoft: "#E4F7EE",
    warning: "#A86108",
    warningSoft: "#FFF3D8",
    danger: "#B42318",
    dangerSoft: "#FDECEA",
    info: "#1769AA",
    infoSoft: "#E8F3FC",
    white: "#FFFFFF",
  },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: {
    display: { fontSize: 30, fontWeight: "800" as const, lineHeight: 36 },
    title: { fontSize: 22, fontWeight: "800" as const, lineHeight: 28 },
    heading: { fontSize: 17, fontWeight: "700" as const, lineHeight: 23 },
    body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
    label: { fontSize: 13, fontWeight: "700" as const, lineHeight: 18 },
    caption: { fontSize: 12, fontWeight: "600" as const, lineHeight: 17 },
  },
  shadow: Platform.select({
    ios: {
      shadowColor: "#12211E",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

