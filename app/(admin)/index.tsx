import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CardSkeleton } from "../../components/ui/skeleton";
import { StateMessage } from "../../components/ui/state-message";
import { design } from "../../constants/design";
import { disconnectSocket } from "../../lib/socket";
import type { RecentOrder } from "../../store/admin";
import {
  subscribeAdminStats,
  unsubscribeAdminStats,
  useAdminStore,
} from "../../store/admin";
import { useAuthStore } from "../../store/auth";

function getStatusColors(status?: string) {
  switch (status) {
    case "DELIVERED": return { bg: "#dcfce7", text: "#166534" };
    case "CANCELLED": return { bg: "#fee2e2", text: "#b91c1c" };
    case "SEARCHING": return { bg: "#fef3c7", text: "#b45309" };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
    case "IN_TRANSIT": return { bg: "#e0e7ff", text: "#4338ca" };
    default: return { bg: "#e5e7eb", text: "#111827" };
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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

function RecentOrderCard({ order }: { order: RecentOrder }) {
  const statusColors = getStatusColors(order.status);

  return (
    <TouchableOpacity
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
          {order.pickupAddress || "Unknown pickup"} → {order.dropoffAddress || "Unknown dropoff"}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
            {order.status || "UNKNOWN"}
          </Text>
        </View>
      </View>
      <Text style={styles.orderMeta}>
        Price: KES {Number(order.estimatedPrice ?? 0).toLocaleString()}
      </Text>
      <Text style={styles.orderMeta}>
        {order.createdAt && Number.isFinite(Date.parse(order.createdAt))
          ? new Date(order.createdAt).toLocaleString("en-KE", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Time unavailable"}
      </Text>
      <View style={styles.orderFooter}>
        <Text style={styles.orderFooterText}>Open trip details</Text>
        <Ionicons name="chevron-forward" size={16} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const stats = useAdminStore((s) => s.stats);
  const recentOrders = useAdminStore((s) => s.recentOrders);
  const loading = useAdminStore((s) => s.loading);
  const refreshing = useAdminStore((s) => s.refreshing);
  const error = useAdminStore((s) => s.error);
  const fetchDashboard = useAdminStore((s) => s.fetchDashboard);
  const setRefreshing = useAdminStore((s) => s.setRefreshing);

  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  useEffect(() => {
    subscribeAdminStats();
    return () => unsubscribeAdminStats();
  }, []);

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

  if (loading) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + design.spacing.md },
        ]}
      >
        <CardSkeleton cards={4} />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <StateMessage
          tone="error"
          title="Dashboard unavailable"
          description="We couldn't load live platform data. Check your connection and try again."
        />
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.flex} onPress={() => menuOpen && setMenuOpen(false)}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { paddingTop: insets.top + design.spacing.md }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroBrand}>
                <View style={styles.logoWrap}>
                  <MaterialCommunityIcons name="shield-account-outline" size={28} color="#fff" />
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
                  <Ionicons name="person-circle-outline" size={20} color="#fff" />
                  <Text style={styles.profileText}>
                    {user?.fullName?.split(" ")[0] || "Admin"}
                  </Text>
                  <Ionicons
                    name={menuOpen ? "chevron-up-outline" : "chevron-down-outline"}
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>

                {menuOpen && (
                  <View style={styles.profileMenu}>
                    <TouchableOpacity
                      style={styles.profileMenuItem}
                      onPress={() => {
                        setMenuOpen(false);
                        router.push("/(admin)/profile");
                      }}
                    >
                      <Ionicons name="settings-outline" size={18} color="#111827" />
                      <Text style={styles.profileMenuText}>Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.profileMenuItem, styles.profileMenuDanger]}
                      onPress={handleLogout}
                    >
                      <Ionicons name="log-out-outline" size={18} color="#b91c1c" />
                      <Text style={styles.profileMenuDangerText}>Log Out</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.overviewGrid}>
              <StatCard label="Active Trips" value={stats.activeTrips} icon="navigate-outline" />
              <StatCard label="Online Drivers" value={stats.onlineDrivers} icon="car-sport-outline" />
              <StatCard label="Pending Approvals" value={stats.pendingDrivers} icon="time-outline" />
              <StatCard
                label="Delivered Revenue"
                value={`KES ${Number(stats.deliveredRevenue).toLocaleString()}`}
                icon="cash-outline"
              />
              <StatCard label="Cancelled Trips" value={stats.cancelledTrips} icon="close-circle-outline" />
              <StatCard
                label="Open Alerts"
                value={stats.pendingDrivers + stats.pendingOrders}
                icon="alert-circle-outline"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Admin tools</Text>
          <View style={styles.grid2}>
            <WorkspaceCard
              title="Pending Drivers"
              subtitle="Review driver applications awaiting approval."
              icon="time-outline"
              accent="#a16207"
              onPress={() => router.push("/(admin)/pending-drivers")}
            />
            <WorkspaceCard
              title="All Trips"
              subtitle="Review delivery requests and trip history."
              icon="trail-sign-outline"
              accent="#1d4ed8"
              onPress={() => router.push("/(admin)/trips")}
            />
            <WorkspaceCard
              title="All Users"
              subtitle="Manage customers, drivers, and admin accounts."
              icon="people-outline"
              accent="#111827"
              onPress={() => router.push("/(admin)/users")}
            />
            <WorkspaceCard
              title="Live Map"
              subtitle="Monitor active drivers and delivery activity."
              icon="map-outline"
              accent="#0f766e"
              onPress={() => router.push("/(admin)/live-map")}
            />
            <WorkspaceCard
              title="Settings"
              subtitle="Manage your profile and security settings."
              icon="settings-outline"
              accent="#7c3aed"
              onPress={() => router.push("/(admin)/profile")}
            />
          </View>

          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.recentWrap}>
            {recentOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No recent orders yet</Text>
                <Text style={styles.emptyText}>
                  New transport requests will appear here once they are created.
                </Text>
              </View>
            ) : (
              recentOrders
                .slice(0, 5)
                .map((order) => <RecentOrderCard key={order.id} order={order} />)
            )}
          </View>
        </ScrollView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3f4f6" },
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { paddingBottom: design.spacing.lg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: design.spacing.lg,
  },
  retryButton: {
    marginTop: design.spacing.md,
    backgroundColor: "#0f172a",
    borderRadius: design.radius.md,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
  },
  retryButtonText: { color: "#fff", fontWeight: "800" },

  hero: {
    backgroundColor: "#09090b",
    paddingHorizontal: design.spacing.md,
    paddingBottom: design.spacing.lg,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: design.spacing.sm,
    zIndex: 10,
  },
  heroBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.md,
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
  heroTextWrap: { flex: 1 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  heroSubtitle: {
    color: "#a1a1aa",
    marginTop: design.spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },

  profileArea: { position: "relative" },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    borderRadius: design.radius.pill,
  },
  profileText: { color: "#fff", fontWeight: "800", maxWidth: 90 },
  profileMenu: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 180,
    backgroundColor: "#fff",
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: design.spacing.sm,
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
    gap: design.spacing.sm,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.md,
  },
  profileMenuText: { color: "#111827", fontWeight: "800", fontSize: 14 },
  profileMenuDanger: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: design.spacing.xs,
  },
  profileMenuDangerText: { color: "#b91c1c", fontWeight: "900", fontSize: 14 },

  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: design.spacing.md,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    marginBottom: design.spacing.md,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: design.radius.md,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: design.spacing.sm,
  },
  statLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: "800" },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: design.spacing.xs },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    paddingHorizontal: design.spacing.md,
    marginTop: design.spacing.lg,
    marginBottom: design.spacing.md,
  },

  grid2: {
    paddingHorizontal: design.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  workspaceCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: design.radius.xl,
    padding: design.spacing.md,
    marginBottom: design.spacing.md,
    borderWidth: 1,
    minHeight: 170,
    justifyContent: "space-between",
  },
  workspaceIconWrap: {
    width: 54,
    height: 54,
    borderRadius: design.radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  workspaceTitle: {
    marginTop: design.spacing.md,
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  workspaceSubtitle: {
    marginTop: design.spacing.xs,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  workspaceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.xs,
    marginTop: design.spacing.md,
  },
  workspaceOpenText: { fontWeight: "900", fontSize: 13 },

  recentWrap: { paddingHorizontal: design.spacing.md, paddingBottom: design.spacing.lg },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: design.radius.xl,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: design.spacing.sm,
    marginBottom: design.spacing.sm,
    alignItems: "flex-start",
  },
  orderRoute: { flex: 1, fontSize: 15, fontWeight: "800", color: "#111827" },
  statusBadge: {
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
    borderRadius: design.radius.pill,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "900" },
  orderMeta: { color: "#475569", marginTop: design.spacing.xs },
  orderFooter: {
    marginTop: design.spacing.md,
    paddingTop: design.spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: design.spacing.xs,
  },
  orderFooterText: { color: "#64748b", fontWeight: "800", fontSize: 12 },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: design.radius.xl,
    padding: design.spacing.lg,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyTitle: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: design.spacing.xs,
  },
  emptyText: { color: "#64748b", textAlign: "center", lineHeight: 20 },
});