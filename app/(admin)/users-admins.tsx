import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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

type AdminUser = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone: string | null;
  role: "ADMIN";
  isActive?: boolean;
  isSuperAdmin?: boolean;
};

function getActiveColors(active?: boolean) {
  return active
    ? { bg: "#DCFCE7", text: "#166534", label: "ACTIVE" }
    : { bg: "#FEE2E2", text: "#B91C1C", label: "SUSPENDED" };
}

export default function AdminAdminsUsersScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    const data = await apiFetch("/admin/users?role=ADMIN");
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    fetchUsers()
      .catch((error: any) => {
        Alert.alert("Load failed", error?.message || "Could not load admins");
      })
      .finally(() => setLoading(false));
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
      superAdmins: users.filter((u) => u.isSuperAdmin).length,
    };
  }, [users]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0B8F47" />
        <Text style={styles.loadingText}>Loading admins...</Text>
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
          <Text style={styles.title}>Admins</Text>
          <Text style={styles.subtitle}>
            Internal admin accounts with dashboard access.
          </Text>

          <View style={styles.statsGrid}>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} success />
            <StatCard label="Super" value={stats.superAdmins} dark />
            <StatCard label="Suspended" value={stats.suspended} danger />
          </View>
        </>
      }
      renderItem={({ item }) => {
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
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.fullName?.charAt(0)?.toUpperCase() || "A"}
                </Text>
              </View>

              <View style={styles.rowInfo}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.meta}>{item.phone || "No phone"}</Text>
                <Text style={styles.username}>
                  @{item.username || "no_username"}
                </Text>

                <View style={styles.badgesRow}>
                  <Text
                    style={[
                      styles.badge,
                      {
                        backgroundColor: activeColors.bg,
                        color: activeColors.text,
                      },
                    ]}
                  >
                    {activeColors.label}
                  </Text>

                  {item.isSuperAdmin ? (
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: "#111111", color: "#FFFFFF" },
                      ]}
                    >
                      SUPER ADMIN
                    </Text>
                  ) : null}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
  dark,
}: {
  label: string;
  value: number;
  success?: boolean;
  danger?: boolean;
  dark?: boolean;
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

  if (dark) {
    backgroundColor = "#111111";
    borderColor = "#111111";
    textColor = "#FFFFFF";
  }

  return (
    <View style={[styles.statCard, { backgroundColor, borderColor }]}>
      <Text style={[styles.statNumber, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabelSmall, { color: textColor }]}>{label}</Text>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#C8102E",
  },
  rowInfo: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
  },
  username: {
    marginTop: 4,
    color: "#C8102E",
    fontWeight: "800",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
});
