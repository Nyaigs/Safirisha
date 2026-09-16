import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { design } from "../../constants/design";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function AppButton({ label, onPress, variant = "primary", loading, disabled, style }: Props) {
  const isDisabled = disabled || loading;
  const textColor = variant === "primary" ? design.colors.white : design.colors.brand;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      activeOpacity={0.82}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: design.radius.md, paddingHorizontal: design.spacing.lg },
  primary: { backgroundColor: design.colors.brand },
  secondary: { backgroundColor: design.colors.brandSoft, borderWidth: 1, borderColor: design.colors.brand },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  label: { ...design.typography.label },
});
