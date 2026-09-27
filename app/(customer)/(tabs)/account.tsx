import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListSkeleton } from "../../../components/ui/skeleton";
import { design } from "../../../constants/design";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../../store/auth";

type TripStats = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
};

const emptyStats: TripStats = { totalTrips: 0, completedTrips: 0, cancelledTrips: 0 };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);

  const [stats, setStats] = useState<TripStats>(emptyStats);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const initials = useMemo(() => {
    if (!user?.fullName) return "U";
    const names = user.fullName.trim().split(" ").filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();
    return `${names[0][0]}${names[1][0]}`.toUpperCase();
  }, [user]);

  const fetchProfileAndStats = useCallback(async () => {
    try {
      setStatsError(null);
      const [meData, statsData] = await Promise.all([
        apiFetch("/auth/me", { method: "GET" }),
        apiFetch("/trips/my-stats", { method: "GET" }),
      ]);
      if (meData?.user) setUser(meData.user);
      setStats({
        totalTrips: Number(statsData?.totalTrips ?? 0),
        completedTrips: Number(statsData?.completedTrips ?? 0),
        cancelledTrips: Number(statsData?.cancelledTrips ?? 0),
      });
    } catch (error) {
      console.error("Failed to fetch profile/stats:", error);
      setStatsError("Trip summary is temporarily unavailable. Pull down to try again.");
    }
  }, [setUser]);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      await fetchProfileAndStats();
    } finally {
      setLoadingStats(false);
    }
  }, [fetchProfileAndStats]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchProfileAndStats();
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfileAndStats]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleEditProfile = () => router.push("/(customer)/edit-profile");

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        { paddingBottom: insets.bottom + design.spacing.lg },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, { paddingTop: insets.top + design.spacing.lg }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your Safirisha account</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.7}
          onPress={handleEditProfile}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.fullName ?? "Unknown User"}
          </Text>
          <Text style={styles.userPhone} numberOfLines={1}>
            {user?.phone ?? "No phone number available"}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user?.email ?? "No email available"}
          </Text>
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={14} color={design.colors.white} />
            <Text style={styles.editBadgeText}>Edit Profile</Text>
          </View>
        </TouchableOpacity>

        {loadingStats ? (
          <ListSkeleton rows={1} />
        ) : statsError ? (
          <View style={styles.statsErrorRow}>
            <Ionicons name="cloud-offline-outline" size={17} color="#A86108" />
            <Text style={styles.statsErrorText}>{statsError}</Text>
          </View>
        ) : (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedTrips}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.cancelledTrips}</Text>
              <Text style={styles.statLabel}>Cancelled</Text>
            </View>
          </View>
        )}

        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(customer)/(tabs)/activity")}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons name="history" size={20} color={design.colors.ink} />
              <Text style={styles.menuText}>My Trips</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={design.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(customer)/settings")}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="call-outline" size={20} color={design.colors.ink} />
              <Text style={styles.menuText}>Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={design.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(customer)/privacy")}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={design.colors.ink} />
              <Text style={styles.menuText}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={design.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => router.push("/(customer)/settings")}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="settings-outline" size={20} color={design.colors.ink} />
              <Text style={styles.menuText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={design.colors.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: design.colors.surface },
  container: {
    flex: 1,
    paddingHorizontal: design.spacing.md,
    backgroundColor: design.colors.surface,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: design.spacing.md },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: design.colors.ink,
    marginBottom: design.spacing.xs,
  },
  subtitle: { fontSize: 15, color: design.colors.muted, lineHeight: 22 },
  profileCard: {
    alignItems: "center",
    padding: design.spacing.lg,
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.subtle,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: design.colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: design.spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: design.colors.white },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: design.colors.ink,
    marginBottom: design.spacing.xs,
    textAlign: "center",
  },
  userPhone: { fontSize: 15, color: design.colors.muted, marginBottom: design.spacing.xs },
  userEmail: { fontSize: 14, color: design.colors.muted },
  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: design.spacing.sm,
    backgroundColor: design.colors.ink,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.xs,
    borderRadius: design.radius.pill,
    gap: design.spacing.xs,
  },
  editBadgeText: { color: design.colors.white, fontSize: 13, fontWeight: "700" },
  statsCard: {
    flexDirection: "row",
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.lg,
    paddingVertical: design.spacing.md,
    paddingHorizontal: design.spacing.sm,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: design.spacing.md,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: design.colors.white,
    marginBottom: design.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d1d5db",
    textAlign: "center",
  },
  divider: { width: 1, height: 40, backgroundColor: "#374151" },
  statsErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: "#FFF3D8",
    borderRadius: design.radius.md,
    padding: design.spacing.md,
    marginBottom: design.spacing.md,
  },
  statsErrorText: {
    flex: 1,
    color: "#8A5208",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  menuCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuText: {
    marginLeft: design.spacing.md,
    fontSize: 15,
    fontWeight: "700",
    color: design.colors.ink,
  },
  logoutButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.md,
    alignItems: "center",
  },
  logoutButtonText: { color: "#b91c1c", fontSize: 15, fontWeight: "800" },
});