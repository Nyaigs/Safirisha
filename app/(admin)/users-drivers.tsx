import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";

type DriverUser = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone: string | null;
  role: "DRIVER";
  isActive?: boolean;
  isSuperAdmin?: boolean;
  driverProfile?: {
    plateNumber: string;
    vehicleType: string;
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | string;
    availability?: "OFFLINE" | "ONLINE" | "BUSY" | string;
  } | null;
};

function getApprovalColors(status?: string) {
  switch (status) {
    case "APPROVED":
      return { bg: "#DCFCE7", text: "#166534" };
    case "REJECTED":
      return { bg: "#FEE2E2", text: "#B91C1C" };
    case "PENDING":
      return { bg: "#FEF3C7", text: "#B45309" };
    default:
      return { bg: "#E5E7EB", text: "#111111" };
  }
}

function getAvailabilityColors(status?: string) {
  switch (status) {
    case "ONLINE":
      return { bg: "#E0F2FE", text: "#0369A1" };
    case "BUSY":
      return { bg: "#DCFCE7", text: "#166534" };
    case "OFFLINE":
      return { bg: "#F3F4F6", text: "#374151" };
    default:
      return { bg: "#E5E7EB", text: "#111111" };
  }
}

function getActiveColors(active?: boolean) {
  return active
    ? { bg: "#DCFCE7", text: "#166534", label: "ACTIVE" }
    : { bg: "#FEE2E2", text: "#B91C1C", label: "SUSPENDED" };
}

function getScreenTitle(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "Approved Drivers";
    case "PENDING":
      return "Pending Drivers";
    case "REJECTED":
      return "Rejected Drivers";
    case "SUSPENDED":
      return "Suspended Drivers";
    default:
      return "Drivers";
  }
}

function getScreenSubtitle(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "Drivers approved and ready for platform operations.";
    case "PENDING":
      return "Drivers awaiting admin review and approval.";
    case "REJECTED":
      return "Drivers whose approval was declined.";
    case "SUSPENDED":
      return "Drivers whose accounts are currently inactive.";
    default:
      return "All driver accounts currently registered on Safirisha.";
  }
}

export default function AdminDriversUsersScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();

  const [users, setUsers] = useState<DriverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    const query = status
      ? `/admin/users?role=DRIVER&status=${encodeURIComponent(status)}`
      : "/admin/users?role=DRIVER";

    const data = await apiFetch(query);
    setUsers(Array.isArray(data?.users) ? data.users : []);
  }, [status]);

  useEffect(() => {
    fetchUsers()
      .catch((error: any) => {
        Alert.alert("Load failed", error?.message || "Could not load drivers");
      })
      .finally(() => setLoading(false));
  }, [fetchUsers]);

  useEffect(() => {
    const socket = connectSocket();

    const onAdminStatsUpdated = () => {
      fetchUsers().catch((error) => {
        console.log("Failed to refresh drivers list:", error);
      });
    };

    socket.on("admin_stats_updated", onAdminStatsUpdated);

    return () => {
      socket.off("admin_stats_updated", onAdminStatsUpdated);
    };
  }, [fetchUsers]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchUsers();
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      suspended: users.filter((u) => !u.isActive).length,
      pending: users.filter(
        (u) => u.driverProfile?.approvalStatus === "PENDING",
      ).length,
      approved: users.filter(
        (u) => u.driverProfile?.approvalStatus === "APPROVED",
      ).length,
      rejected: users.filter(
        (u) => u.driverProfile?.approvalStatus === "REJECTED",
      ).length,
    };
  }, [users]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0B8F47" />
        <Text style={styles.loadingText}>Loading drivers...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={users}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>{getScreenTitle(status)}</Text>
          <Text style={styles.subtitle}>{getScreenSubtitle(status)}</Text>

          <View style={styles.statsGrid}>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} success />
            <StatCard label="Suspended" value={stats.suspended} danger />
            <StatCard label="Pending" value={stats.pending} warning />
            <StatCard label="Approved" value={stats.approved} success />
            <StatCard label="Rejected" value={stats.rejected} danger />
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No drivers found</Text>
          <Text style={styles.emptyText}>
            No driver accounts match this current filter.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const approvalColors = getApprovalColors(
          item.driverProfile?.approvalStatus,
        );
        const availabilityColors = getAvailabilityColors(
          item.driverProfile?.availability,
        );
        const activeColors = getActiveColors(item.isActive);

        return (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/(admin)/user-details",
                params: { userId: item.id },
              })
            }
          >
            <View style={styles.topRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.fullName?.charAt(0)?.toUpperCase() || "D"}
                </Text>
              </View>

              <View style={styles.topInfo}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.meta}>{item.phone || "No phone"}</Text>
                <Text style={styles.username}>
                  @{item.username || "no_username"}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>

            <View style={styles.infoGrid}>
              <InfoBox
                label="Vehicle"
                value={item.driverProfile?.vehicleType || "Not available"}
              />
              <InfoBox
                label="Plate"
                value={item.driverProfile?.plateNumber || "Not available"}
              />
            </View>

            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: activeColors.bg,
                    color: activeColors.text,
                  },
                ]}
              >
                {activeColors.label}
              </Text>

              <Text
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: approvalColors.bg,
                    color: approvalColors.text,
                  },
                ]}
              >
                {item.driverProfile?.approvalStatus || "UNKNOWN"}
              </Text>

              <Text
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: availabilityColors.bg,
                    color: availabilityColors.text,
                  },
                ]}
              >
                {item.driverProfile?.availability || "OFFLINE"}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function StatCard({
  label,
  value,
  success,
  danger,
  warning,
}: {
  label: string;
  value: number;
  success?: boolean;
  danger?: boolean;
  warning?: boolean;
}) {
  let backgroundColor = "#FFFFFF";
  let borderColor = "#E5E7EB";
  let textColor = "#111111";

  if (success) {
    backgroundColor = "#DCFCE7";
    borderColor = "#BBF7D0";
    textColor = "#166534";
  }

  if (danger) {
    backgroundColor = "#FEE2E2";
    borderColor = "#FECACA";
    textColor = "#B91C1C";
  }

  if (warning) {
    backgroundColor = "#FEF3C7";
    borderColor = "#FDE68A";
    textColor = "#B45309";
  }

  return (
    <View style={[styles.statCard, { backgroundColor, borderColor }]}>
      <Text style={[styles.statNumber, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabelSmall, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBoxCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  listContent: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748B",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 21,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabelSmall: {
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0B8F47",
  },
  topInfo: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 2,
  },
  username: {
    marginTop: 4,
    color: "#0B8F47",
    fontWeight: "800",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  infoBoxCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#111111",
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  statusChip: {
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    marginTop: 10,
  },
  emptyTitle: {
    textAlign: "center",
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    lineHeight: 20,
  },
});
