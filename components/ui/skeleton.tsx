import { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { design } from "../../constants/design";

type SkeletonBlockProps = {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function SkeletonBlock({ width = "100%", height = 16, radius = design.radius.sm, style }: SkeletonBlockProps) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [phase]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: interpolate(phase.value, [0, 1], [0.45, 0.9]) }));

  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.block, { width, height, borderRadius: radius }, animatedStyle, style]} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading content">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={48} height={48} radius={design.radius.md} />
          <View style={styles.rowText}>
            <SkeletonBlock width="68%" height={16} />
            <SkeletonBlock width="92%" height={12} style={styles.lineGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <View style={styles.cards} accessibilityLabel="Loading cards">
      {Array.from({ length: cards }, (_, index) => (
        <View key={index} style={styles.card}>
          <SkeletonBlock width="46%" height={14} />
          <SkeletonBlock width="72%" height={26} style={styles.cardValue} />
          <SkeletonBlock width="88%" height={12} style={styles.cardMeta} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: design.colors.border, overflow: "hidden" },
  list: { gap: design.spacing.md, padding: design.spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: design.spacing.md, padding: design.spacing.sm, backgroundColor: design.colors.surface, borderRadius: design.radius.md },
  rowText: { flex: 1, gap: design.spacing.xs },
  lineGap: { marginTop: design.spacing.xxs },
  cards: { gap: design.spacing.sm, padding: design.spacing.md },
  card: { gap: design.spacing.xs, padding: design.spacing.md, backgroundColor: design.colors.surface, borderRadius: design.radius.md, borderWidth: 1, borderColor: design.colors.border },
  cardValue: { marginTop: design.spacing.xxs },
  cardMeta: { marginTop: design.spacing.xxs },
});
