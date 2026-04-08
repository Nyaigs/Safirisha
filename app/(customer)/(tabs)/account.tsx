import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../../store/auth";

type TripStats = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
};

const emptyStats: TripStats = {
  totalTrips: 0,
  completedTrips: 0,
  cancelledTrips: 0,
};

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);

  const [stats, setStats] = useState<TripStats>(emptyStats);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const initials = useMemo(() => {
    if (!user?.fullName) return "U";

    const names = user.fullName.trim().split(" ").filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();

    return `${names[0][0]}${names[1][0]}`.toUpperCase();
  }, [user?.fullName]);

  const fetchProfileAndStats = useCallback(async () => {
    try {
      const [meData, statsData] = await Promise.all([
        apiFetch("/auth/me", { method: "GET" }),
        apiFetch("/trips/my-stats", { method: "GET" }),
      ]);

      if (meData?.user) {
        setUser(meData.user);
      }

      setStats({
        totalTrips: Number(statsData?.totalTrips ?? 0),
        completedTrips: Number(statsData?.completedTrips ?? 0),
        cancelledTrips: Number(statsData?.cancelledTrips ?? 0),
      });
    } catch (error) {
      console.error("Failed to fetch profile/stats:", error);
      setStats(emptyStats);
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

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

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

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(customer)/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your Safirisha account</Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.userName}>
            {user?.fullName ?? "Unknown User"}
          </Text>
          <Text style={styles.userPhone}>
            {user?.phone ?? "No phone number available"}
          </Text>
          <Text style={styles.userEmail}>
            {user?.email ?? "No email available"}
          </Text>
        </View>

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

        {loadingStats && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#111827" />
            <Text style={styles.loadingText}>Loading trip summary...</Text>
          </View>
        )}

        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(customer)/(tabs)/activity")}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons
                name="history"
                size={20}
                color="#111827"
              />
              <Text style={styles.menuText}>My Trips</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert("Support", "Support screen not connected yet.")
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="call-outline" size={20} color="#111827" />
              <Text style={styles.menuText}>Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                "Privacy & Security",
                "Privacy screen not connected yet.",
              )
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#111827"
              />
              <Text style={styles.menuText}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert("Settings", "Settings screen not connected yet.")
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="settings-outline" size={20} color="#111827" />
              <Text style={styles.menuText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace("/(customer)/(tabs)")}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
  },
  profileCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  userPhone: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 14,
    color: "#6b7280",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d1d5db",
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#374151",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: "#4b5563",
    fontSize: 14,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  homeButton: {
    backgroundColor: "#111827",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#b91c1c",
    fontSize: 15,
    fontWeight: "700",
  },
});
