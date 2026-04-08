import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const driverGroups = [
  {
    label: "All Drivers",
    subtitle: "View every registered driver account",
    params: {},
    icon: "car-sport-outline" as const,
    tint: "#e0e7ff",
    iconColor: "#4338ca",
  },
  {
    label: "Approved Drivers",
    subtitle: "Drivers cleared to operate",
    params: { status: "APPROVED" },
    icon: "checkmark-done-outline" as const,
    tint: "#dcfce7",
    iconColor: "#166534",
  },
  {
    label: "Pending Drivers",
    subtitle: "Awaiting admin approval",
    params: { status: "PENDING" },
    icon: "time-outline" as const,
    tint: "#fef3c7",
    iconColor: "#b45309",
  },
  {
    label: "Rejected Drivers",
    subtitle: "Approval declined accounts",
    params: { status: "REJECTED" },
    icon: "close-circle-outline" as const,
    tint: "#fee2e2",
    iconColor: "#b91c1c",
  },
  {
    label: "Suspended Drivers",
    subtitle: "Inactive driver accounts",
    params: { status: "SUSPENDED" },
    icon: "ban-outline" as const,
    tint: "#f3f4f6",
    iconColor: "#374151",
  },
];

export default function DriversScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Management</Text>
      <Text style={styles.subtitle}>
        Split drivers by approval state or account status, then drill down into
        details and actions.
      </Text>

      {driverGroups.map((group) => (
        <TouchableOpacity
          key={group.label}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: "/(admin)/users-drivers",
              params: group.params,
            })
          }
        >
          <View style={[styles.iconWrap, { backgroundColor: group.tint }]}>
            <Ionicons name={group.icon} size={24} color={group.iconColor} />
          </View>

          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{group.label}</Text>
            <Text style={styles.cardSubtitle}>{group.subtitle}</Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
    paddingTop: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748b",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  cardSubtitle: {
    color: "#64748b",
    lineHeight: 19,
    fontSize: 13,
    fontWeight: "600",
  },
});
