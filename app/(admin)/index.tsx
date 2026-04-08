import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket, disconnectSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";

type DashboardStats = {
  totalOrders: number;
  activeTrips: number;
  deliveredTrips: number;
  cancelledTrips: number;
  pendingOrders: number;
  pendingDrivers: number;
  approvedDrivers: number;
  rejectedDrivers: number;
  onlineDrivers: number;
  busyDrivers: number;
  activeDrivers: number;
  totalUsers: number;
  totalCustomers: number;
  totalDrivers: number;
  totalAdmins: number;
  activeUsers: number;
  suspendedUsers: number;
  deliveredRevenue: number;
};

type RecentOrder = {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  vehicleType?: string;
  loadSize?: string;
  estimatedPrice?: number;
  status?: string;
  customer?: {
    fullName?: string;
  };
  assignedDriver?: {
    user?: {
      fullName?: string;
    };
  } | null;
};

const FALLBACK_STATS: DashboardStats = {
  totalOrders: 0,
  activeTrips: 0,
  deliveredTrips: 0,
  cancelledTrips: 0,
  pendingOrders: 0,
  pendingDrivers: 0,
  approvedDrivers: 0,
  rejectedDrivers: 0,
  onlineDrivers: 0,
  busyDrivers: 0,
  activeDrivers: 0,
  totalUsers: 0,
  totalCustomers: 0,
  totalDrivers: 0,
  totalAdmins: 0,
  activeUsers: 0,
  suspendedUsers: 0,
  deliveredRevenue: 0,
};

function getStatusColors(status?: string) {
  switch (status) {
    case "DELIVERED":
      return { bg: "#dcfce7", text: "#166534" };
    case "CANCELLED":
      return { bg: "#fee2e2", text: "#b91c1c" };
    case "SEARCHING":
      return { bg: "#fef3c7", text: "#b45309" };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
    case "IN_TRANSIT":
      return { bg: "#e0e7ff", text: "#4338ca" };
    default:
      return { bg: "#e5e7eb", text: "#111827" };
  }
}

export default function AdminDashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [stats, setStats] = useState<DashboardStats>(FALLBACK_STATS);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/dashboard");
      const s = res?.stats ?? {};

      setStats({
        totalOrders: s.totalOrders ?? 0,
        activeTrips: s.activeTrips ?? 0,
        deliveredTrips: s.deliveredTrips ?? 0,
        cancelledTrips: s.cancelledTrips ?? 0,
        pendingOrders: s.pendingOrders ?? 0,
        pendingDrivers: s.pendingDrivers ?? 0,
        approvedDrivers: s.approvedDrivers ?? 0,
        rejectedDrivers: s.rejectedDrivers ?? 0,
        onlineDrivers: s.onlineDrivers ?? 0,
        busyDrivers: s.busyDrivers ?? 0,
        activeDrivers: s.activeDrivers ?? 0,
        totalUsers: s.totalUsers ?? 0,
        totalCustomers: s.totalCustomers ?? 0,
        totalDrivers: s.totalDrivers ?? 0,
        totalAdmins: s.totalAdmins ?? 0,
        activeUsers: s.activeUsers ?? 0,
        suspendedUsers: s.suspendedUsers ?? 0,
        deliveredRevenue: s.deliveredRevenue ?? 0,
      });

      setRecentOrders(Array.isArray(res?.recentOrders) ? res.recentOrders : []);
    } catch (error) {
      console.log("Dashboard fetch failed:", error);
      setStats(FALLBACK_STATS);
      setRecentOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  useEffect(() => {
    const socket = connectSocket();

    const onAdminStatsUpdated = () => {
      fetchDashboard();
    };

    socket.on("admin_stats_updated", onAdminStatsUpdated);

    return () => {
      socket.off("admin_stats_updated", onAdminStatsUpdated);
    };
  }, [fetchDashboard]);

  const handleLogout = useCallback(() => {
    disconnectSocket();
    logout();
    setMenuOpen(false);
    router.replace("/(auth)/login");
  }, [logout]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const overviewCards = useMemo(
    () => [
      {
        label: "Total Requests",
        value: stats.totalOrders,
        icon: "cube-outline" as const,
      },
      {
        label: "Active Trips",
        value: stats.activeTrips,
        icon: "navigate-outline" as const,
      },
      {
        label: "Online Drivers",
        value: stats.onlineDrivers,
        icon: "car-sport-outline" as const,
      },
      {
        label: "Revenue",
        value: `KES ${Number(stats.deliveredRevenue).toLocaleString()}`,
        icon: "cash-outline" as const,
      },
    ],
    [stats],
  );

  const usersCenterCards = useMemo(
    () => [
      {
        label: "Customers",
        value: stats.totalCustomers,
        icon: "person-outline" as const,
        onPress: () =>
          router.push({
            pathname: "/(admin)/users",
            params: { role: "CUSTOMER" },
          }),
      },
      {
        label: "Drivers",
        value: stats.totalDrivers,
        icon: "car-outline" as const,
        onPress: () =>
          router.push({
            pathname: "/(admin)/users",
            params: { role: "DRIVER" },
          }),
      },
      {
        label: "Admins",
        value: stats.totalAdmins,
        icon: "shield-checkmark-outline" as const,
        onPress: () =>
          router.push({
            pathname: "/(admin)/users",
            params: { role: "ADMIN" },
          }),
      },
      {
        label: "Pending Drivers",
        value: stats.pendingDrivers,
        icon: "time-outline" as const,
        onPress: () =>
          router.push({
            pathname: "/(admin)/users",
            params: { role: "DRIVER", driverApproval: "PENDING" },
          }),
      },
      {
        label: "Create User",
        value: "New",
        icon: "person-add-outline" as const,
        onPress: () => router.push("/(admin)/create-user"),
      },
    ],
    [stats],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading admin console...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.flex}
        onPress={() => menuOpen && setMenuOpen(false)}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroBrand}>
                <View style={styles.logoWrap}>
                  <MaterialCommunityIcons
                    name="shield-account-outline"
                    size={28}
                    color="#fff"
                  />
                </View>

                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>Admin Console</Text>
                  <Text style={styles.heroSubtitle}>
                    Platform operations, monitoring, and user control.
                  </Text>
                </View>
              </View>

              <View style={styles.profileArea}>
                <TouchableOpacity
                  style={styles.profilePill}
                  activeOpacity={0.85}
                  onPress={() => setMenuOpen((prev) => !prev)}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.profileText}>
                    {user?.fullName?.split(" ")[0] || "Admin"}
                  </Text>
                  <Ionicons
                    name={
                      menuOpen ? "chevron-up-outline" : "chevron-down-outline"
                    }
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>

                {menuOpen ? (
                  <View style={styles.profileMenu}>
                    <TouchableOpacity
                      style={styles.profileMenuItem}
                      onPress={() => {
                        setMenuOpen(false);
                        router.push("/(admin)/profile");
                      }}
                    >
                      <Ionicons
                        name="settings-outline"
                        size={18}
                        color="#111827"
                      />
                      <Text style={styles.profileMenuText}>Settings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.profileMenuItem, styles.profileMenuDanger]}
                      onPress={handleLogout}
                    >
                      <Ionicons
                        name="log-out-outline"
                        size={18}
                        color="#b91c1c"
                      />
                      <Text style={styles.profileMenuDangerText}>Log Out</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.heroSummaryCard}>
              <View style={styles.heroSummaryTop}>
                <Text style={styles.heroSummaryHeading}>Live overview</Text>
                <TouchableOpacity
                  style={styles.refreshChip}
                  onPress={onRefresh}
                >
                  <Ionicons name="refresh-outline" size={15} color="#fff" />
                  <Text style={styles.refreshChipText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroSummaryBody}>
                Jump into the main admin workspaces below and manage the
                platform faster with fewer taps.
              </Text>

              <View style={styles.overviewGrid}>
                {overviewCards.map((card) => (
                  <View key={card.label} style={styles.overviewCard}>
                    <View style={styles.overviewIconWrap}>
                      <Ionicons name={card.icon} size={18} color="#fff" />
                    </View>
                    <Text style={styles.overviewLabel}>{card.label}</Text>
                    <Text style={styles.overviewValue}>{card.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Workspace</Text>
          <View style={styles.workspaceGrid}>
            <WorkspaceCard
              title="Users Center"
              subtitle="Manage customers, drivers, admins, approvals, and accounts."
              icon="people-outline"
              accent="#111827"
              onPress={() => router.push("/(admin)/users")}
            />
            <WorkspaceCard
              title="Trips & Requests"
              subtitle="Track jobs, delivery flow, and request lifecycle."
              icon="trail-sign-outline"
              accent="#1d4ed8"
              onPress={() => router.push("/(admin)/trips")}
            />
            <WorkspaceCard
              title="Live Map"
              subtitle="Monitor driver movement and live platform activity."
              icon="map-outline"
              accent="#0f766e"
              onPress={() => router.push("/(admin)/live-map")}
            />
            <WorkspaceCard
              title="System & Settings"
              subtitle="Open admin settings, profile, and password controls."
              icon="settings-outline"
              accent="#7c3aed"
              onPress={() => router.push("/(admin)/profile")}
            />
          </View>

          <Text style={styles.sectionTitle}>Users Center</Text>
          <View style={styles.shortcutGrid}>
            {usersCenterCards.map((item) => (
              <MiniShortcutCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                onPress={item.onPress}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Platform Snapshot</Text>
          <View style={styles.snapshotGrid}>
            <SnapshotCard label="Pending Orders" value={stats.pendingOrders} />
            <SnapshotCard
              label="Delivered Trips"
              value={stats.deliveredTrips}
            />
            <SnapshotCard
              label="Cancelled Trips"
              value={stats.cancelledTrips}
            />
            <SnapshotCard
              label="Approved Drivers"
              value={stats.approvedDrivers}
            />
            <SnapshotCard
              label="Rejected Drivers"
              value={stats.rejectedDrivers}
            />
            <SnapshotCard label="Busy Drivers" value={stats.busyDrivers} />
            <SnapshotCard label="Active Users" value={stats.activeUsers} />
            <SnapshotCard
              label="Suspended Users"
              value={stats.suspendedUsers}
            />
          </View>

          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <View style={styles.recentWrap}>
            {recentOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recent orders yet</Text>
                <Text style={styles.emptyText}>
                  New transport requests will appear here once they are created.
                </Text>
              </View>
            ) : (
              recentOrders.map((order) => {
                const statusColors = getStatusColors(order.status);

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    activeOpacity={0.9}
                    onPress={() =>
                      router.push({
                        pathname: "/(admin)/trip-details",
                        params: { tripId: order.id },
                      })
                    }
                  >
                    <View style={styles.orderTop}>
                      <Text style={styles.orderRoute} numberOfLines={2}>
                        {order.pickupAddress || "Unknown pickup"} →{" "}
                        {order.dropoffAddress || "Unknown dropoff"}
                      </Text>

                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusColors.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: statusColors.text },
                          ]}
                        >
                          {order.status || "UNKNOWN"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.orderMeta}>
                      Customer: {order.customer?.fullName || "—"}
                    </Text>
                    <Text style={styles.orderMeta}>
                      Driver:{" "}
                      {order.assignedDriver?.user?.fullName || "Not assigned"}
                    </Text>
                    <Text style={styles.orderMeta}>
                      Vehicle: {order.vehicleType || "—"} • Load:{" "}
                      {order.loadSize || "—"}
                    </Text>
                    <Text style={styles.orderMeta}>
                      Price: KES{" "}
                      {Number(order.estimatedPrice ?? 0).toLocaleString()}
                    </Text>

                    <View style={styles.orderFooter}>
                      <Text style={styles.orderFooterText}>
                        Open trip details
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#64748b"
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </Pressable>
    </View>
  );
}

function WorkspaceCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.workspaceCard, { borderColor: `${accent}22` }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.workspaceIconWrap, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>

      <Text style={styles.workspaceTitle}>{title}</Text>
      <Text style={styles.workspaceSubtitle}>{subtitle}</Text>

      <View style={styles.workspaceFooter}>
        <Text style={[styles.workspaceOpenText, { color: accent }]}>Open</Text>
        <Ionicons name="arrow-forward" size={16} color={accent} />
      </View>
    </TouchableOpacity>
  );
}

function MiniShortcutCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.shortcutCard}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.shortcutIconWrap}>
        <Ionicons name={icon} size={18} color="#0f172a" />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
      <Text style={styles.shortcutValue}>{value}</Text>
    </TouchableOpacity>
  );
}

function SnapshotCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.snapshotCard}>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={styles.snapshotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
  },

  hero: {
    backgroundColor: "#09090b",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    zIndex: 10,
  },
  heroBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#a1a1aa",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },

  profileArea: {
    position: "relative",
  },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  profileText: {
    color: "#fff",
    fontWeight: "800",
    maxWidth: 90,
  },
  profileMenu: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 180,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 50,
  },
  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileMenuText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 14,
  },
  profileMenuDanger: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 4,
  },
  profileMenuDangerText: {
    color: "#b91c1c",
    fontWeight: "900",
    fontSize: 14,
  },

  heroSummaryCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  heroSummaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroSummaryHeading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  refreshChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1f2937",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  refreshChipText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  heroSummaryBody: {
    color: "#d1d5db",
    marginTop: 10,
    lineHeight: 20,
  },

  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  overviewCard: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  overviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  overviewLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
  },
  overviewValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 12,
  },

  workspaceGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  workspaceCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    minHeight: 170,
    justifyContent: "space-between",
  },
  workspaceIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  workspaceTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  workspaceSubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  workspaceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  workspaceOpenText: {
    fontWeight: "900",
    fontSize: 13,
  },

  shortcutGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  shortcutCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 120,
    justifyContent: "space-between",
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  shortcutLabel: {
    marginTop: 10,
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  shortcutValue: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  snapshotGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  snapshotCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  snapshotValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
  snapshotLabel: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },

  recentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    alignItems: "flex-start",
  },
  orderRoute: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  orderMeta: {
    color: "#475569",
    marginTop: 4,
  },
  orderFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  orderFooterText: {
    color: "#64748b",
    fontWeight: "800",
    fontSize: 12,
  },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyTitle: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
});
