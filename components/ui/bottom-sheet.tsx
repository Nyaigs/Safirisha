import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { clampSheetDrag, nearestSheetSnap, sheetSnapOffsets } from "../../utils/sheet";
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
import { design, snapPoints as responsiveSnapPoints } from "../../constants/design";
import { useLayout } from "../../constants/layout";

type Props = {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnap?: number;
};

export function BottomSheet({
  visible,
  onClose: _onClose,
  children,
  snapPoints,
  initialSnap = 0,
}: Props) {
  const { height: SCREEN_HEIGHT, isSmall, isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue(0);
  const availableHeight = Math.max(0, SCREEN_HEIGHT - insets.top);
  const size = isSmall ? "small" : isTablet ? "tablet" : "medium";
  const snapKey = snapPoints?.join(",") ?? "";

  const visibleHeights = useMemo(() => {
    const points = snapKey.split(",").filter((point) => point.trim() !== "")
      .map(Number).filter(Number.isFinite);
    return points.length
      ? sheetSnapOffsets(availableHeight, points).map((offset) => availableHeight - offset)
      : responsiveSnapPoints(availableHeight, size);
  }, [availableHeight, size, snapKey]);

  // translateY = where the top of the sheet sits (0 = top of screen, SCREEN_HEIGHT = hidden)
  // height of sheet = SCREEN_HEIGHT - translateY
  const snapValues = useMemo(
    () => visibleHeights.map((height) => SCREEN_HEIGHT - height),
    [SCREEN_HEIGHT, visibleHeights],
  );

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(snapValues[initialSnap] ?? snapValues[0], {
        damping: 24,
        stiffness: 240,
      });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 15, stiffness: 120 });
    }
  }, [visible, initialSnap, snapValues, translateY, SCREEN_HEIGHT]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.set(translateY.get());
    })
    .onUpdate((e) => {
      translateY.set(clampSheetDrag(context.get(), e.translationY, snapValues));
    })
    .onEnd((e) => {
      translateY.set(
        withSpring(nearestSheetSnap(translateY.get(), e.velocityY, snapValues), {
          damping: 24,
          stiffness: 240,
        })
      );
    });

  const animatedStyle = useAnimatedStyle(() => {
    const height = SCREEN_HEIGHT - translateY.value;
    return {
      height: Math.max(0, Math.min(height, SCREEN_HEIGHT)),
    };
  });

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View
        pointerEvents="none"
        style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}
      />
      <Animated.View style={[styles.sheet, animatedStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
          {children}
        </View>
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
    overflow: "hidden",
  },
  handleArea: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 60,
    marginBottom: design.spacing.sm,
  },
  handle: {
    height: 5,
    width: 44,
    borderRadius: design.radius.pill,
    backgroundColor: "#B9C6C1",
  },
  content: {
    flex: 1,
  },
});
