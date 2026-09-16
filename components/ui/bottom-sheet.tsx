import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  visible: boolean;
  /** Kept for compatibility with sheets that are controlled externally. */
  onClose?: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnap?: number;
};

export function BottomSheet({
  visible,
  onClose: _onClose,
  children,
  snapPoints = [30, 60, 90],
  initialSnap = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const context = useSharedValue(0);

  const sheetHeight = Math.round((SCREEN_HEIGHT - insets.top) * 0.9);

  // The sheet is bottom-anchored. A snap point is the visible portion of the
  // screen, so its translation is the remaining hidden portion of the sheet.
  const snapValues = useMemo(() => {
    const availableHeight = SCREEN_HEIGHT - insets.top;
    return snapPoints.map((point) => {
      const visibleHeight = Math.min(Math.max(point, 0), 90) / 100 * availableHeight;
      return Math.max(0, sheetHeight - visibleHeight);
    });
  }, [insets.top, sheetHeight, snapPoints]);

  // Set initial position
  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(snapValues[initialSnap] || snapValues[0], {
        damping: 15,
        stiffness: 120,
      });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 15, stiffness: 120 });
    }
  }, [visible, initialSnap, snapValues, translateY]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((e) => {
      const newValue = context.value - e.translationY;
      // Clamp so sheet doesn't go off screen
      const min = 0;
      const max = snapValues[0] ?? 0;
      translateY.value = Math.min(Math.max(newValue, min), max);
    })
    .onEnd(() => {
      // Snap to nearest point
      const current = translateY.value;
      let closest = snapValues[0];
      let minDiff = Infinity;
      for (const val of snapValues) {
        const diff = Math.abs(current - val);
        if (diff < minDiff) {
          minDiff = diff;
          closest = val;
        }
      }
      translateY.value = withSpring(closest, { damping: 15, stiffness: 120 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View
        pointerEvents="none"
        style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}
      />
      <Animated.View style={[styles.sheet, animatedStyle, { height: sheetHeight, paddingBottom: insets.bottom + 16 }]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.handle} />
        </GestureDetector>
        {children}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "box-none",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: design.colors.surface,
    borderTopLeftRadius: design.radius.xl,
    borderTopRightRadius: design.radius.xl,
    paddingHorizontal: design.spacing.md,
    paddingTop: design.spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    alignSelf: "center",
    height: 5,
    width: 44,
    borderRadius: design.radius.pill,
    backgroundColor: "#B9C6C1",
    marginBottom: design.spacing.sm,
  },
});
