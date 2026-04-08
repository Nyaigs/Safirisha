import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../store/auth";

export default function AdminProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstLetter = useMemo(
    () => user?.fullName?.charAt(0)?.toUpperCase() || "A",
    [user?.fullName],
  );

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiFetch("/auth/me", { method: "GET" });
      if (data?.user) {
        setUser(data.user);
      }
    } catch (error: any) {
      console.log("Failed to load admin profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProfile();
    }, [loadProfile]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out of the admin panel?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  };

  if (loading && !user) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.centerText}>Loading admin profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Admin Profile</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>

        <Text style={styles.name}>{user?.fullName || "Admin User"}</Text>

        <View style={styles.roleBadge}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.roleBadgeText}>{user?.role || "ADMIN"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color="#111111" />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Full Name</Text>
              <Text style={styles.detailValue}>
                {user?.fullName || "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Ionicons name="at-outline" size={18} color="#111111" />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Username</Text>
              <Text style={styles.detailValue}>
                {user?.username || "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={18} color="#111111" />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>
                {user?.email || "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color="#111111" />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>
                {user?.phone || "Not available"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin Actions</Text>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/edit-profile")}
        >
          <View style={styles.actionLeft}>
            <View
              style={[styles.actionIconWrap, { backgroundColor: "#E5E7EB" }]}
            >
              <Ionicons name="create-outline" size={18} color="#111111" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionDesc}>
                Update account details and admin identity info.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/change-password")}
        >
          <View style={styles.actionLeft}>
            <View
              style={[styles.actionIconWrap, { backgroundColor: "#DCFCE7" }]}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#0B8F47" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Change Password</Text>
              <Text style={styles.actionDesc}>
                Secure this admin account with a new password.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>

        <Pressable style={styles.logoutCard} onPress={handleLogout}>
          <View style={styles.actionLeft}>
            <View
              style={[styles.actionIconWrap, { backgroundColor: "#FEE2E2" }]}
            >
              <Ionicons name="log-out-outline" size={18} color="#C8102E" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.logoutTitle}>Log Out</Text>
              <Text style={styles.logoutDesc}>
                End the current admin session safely.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  content: {
    paddingBottom: 32,
  },
  centerScreen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: {
    marginTop: 10,
    color: "#64748B",
    fontWeight: "700",
  },
  header: {
    backgroundColor: "#111111",
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  name: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111111",
    textAlign: "center",
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B8F47",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  detailTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: "#111111",
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoutCard: {
    backgroundColor: "#FFF1F2",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECDD3",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  logoutTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#C8102E",
    marginBottom: 4,
  },
  logoutDesc: {
    fontSize: 13,
    color: "#9F1239",
    lineHeight: 18,
  },
});
