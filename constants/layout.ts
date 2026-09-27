import { useWindowDimensions } from "react-native";

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isMedium = width >= 360 && width < 414;
  const isLarge = width >= 414 && width < 768;
  const isTablet = width >= 768;
  const isLandscape = width > height;

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    safeTop: 0, // Filled by useSafeAreaInsets at call sites.
    safeBottom: 0,
  };

  const fontScale = isSmall ? 0.9 : isTablet ? 1.1 : 1;

  return {
    width,
    height,
    isSmall,
    isMedium,
    isLarge,
    isTablet,
    isLandscape,
    spacing,
    fontScale,
  };
}
