import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
            color={disabled ? "#9ca3af" : isSelected ? "#111827" : "#374151"}
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
            <Text style={styles.priceText}>KES {price}</Text>
          )}

          {disabled && (
            <Text style={styles.disabledHint}>
              Not available for selected load size
            </Text>
          )}
        </View>

        {isSelected && !disabled && (
          <View style={styles.checkWrap}>
            <Ionicons name="checkmark-circle" size={24} color="#111827" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    backgroundColor: "#fff",
  },
  selectedCard: {
    borderColor: "#111827",
    backgroundColor: "#f3f4f6",
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
    borderRadius: 14,
    backgroundColor: "#f9fafb",
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
    color: "#111827",
  },
  capacity: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 18,
  },
  priceText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#047857",
  },
  disabledHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#b45309",
    fontWeight: "600",
  },
  selectedText: {
    color: "#000",
  },
  selectedSubText: {
    color: "#374151",
  },
  disabledText: {
    color: "#6b7280",
  },
  checkWrap: {
    marginLeft: 12,
  },
});
