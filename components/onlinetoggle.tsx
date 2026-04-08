import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

type Props = {
  value: boolean;
  onToggle: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  labelOn?: string;
  labelOff?: string;
};

export default function OnlineToggle({
  value,
  onToggle,
  disabled = false,
  loading = false,
  labelOn = "Online",
  labelOff = "Offline",
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <View style={[styles.container, isDisabled && styles.containerDisabled]}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{value ? labelOn : labelOff}</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Updating...</Text>
          </View>
        ) : null}
      </View>

      <Switch value={value} onValueChange={onToggle} disabled={isDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 132,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  containerDisabled: {
    opacity: 0.7,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
});
