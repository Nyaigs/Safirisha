import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { design } from "../../constants/design";

type Props = PropsWithChildren<{ style?: StyleProp<ViewStyle>; elevated?: boolean }>;

export function AppCard({ children, style, elevated = false }: Props) {
  return <View style={[styles.card, elevated && design.shadow, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: design.colors.surface, borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.lg, padding: design.spacing.md },
});
