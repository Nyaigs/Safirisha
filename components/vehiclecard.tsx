import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { design } from "../constants/design";

type VehicleCardProps = {
  name: string;
  capacity: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isSelected: boolean;
  onPress: () => void;
  price?: number;
  disabled?: boolean;
};

export default function VehicleCard({
  name,
  capacity,
  icon,
  isSelected,
  onPress,
  price,
  disabled = false,
}: VehicleCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.selectedCard,
        disabled && styles.disabledCard,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, isSelected && styles.selectedIconWrap]}>
          <MaterialCommunityIcons
            name={icon}
            size={28}
            color={disabled ? "#9ca3af" : isSelected ? design.colors.brand : design.colors.ink}
          />
        </View>

        <View style={styles.textWrap}>
          <Text
            style={[
              styles.name,
              isSelected && styles.selectedText,
              disabled && styles.disabledText,
            ]}
          >
            {name}
          </Text>
          <Text
            style={[
              styles.capacity,
              isSelected && styles.selectedSubText,
              disabled && styles.disabledText,
            ]}
          >
            {capacity}
          </Text>

          {typeof price === "number" && !disabled && (
            <Text style={styles.priceText}>From KES {price}</Text>
          )}

          {disabled && (
            <Text style={styles.disabledHint}>
              Not available for selected load size
            </Text>
          )}
        </View>

        {isSelected && !disabled && (
          <View style={styles.checkWrap}>
            <Ionicons name="checkmark-circle" size={24} color={design.colors.brand} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: design.colors.border,
    padding: design.spacing.md,
    backgroundColor: design.colors.surface,
  },
  selectedCard: {
    borderColor: design.colors.brand,
    backgroundColor: design.colors.brandSoft,
  },
  disabledCard: {
    opacity: 0.55,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.subtle,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  selectedIconWrap: {
    backgroundColor: "#e5e7eb",
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: design.colors.ink,
  },
  capacity: {
    fontSize: 13,
    color: design.colors.muted,
    marginTop: 4,
    lineHeight: 18,
  },
  priceText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: design.colors.success,
  },
  disabledHint: {
    marginTop: 6,
    fontSize: 12,
    color: design.colors.warning,
    fontWeight: "600",
  },
  selectedText: {
    color: design.colors.brand,
  },
  selectedSubText: {
    color: design.colors.muted,
  },
  disabledText: {
    color: design.colors.muted,
  },
  checkWrap: {
    marginLeft: 12,
  },
});
