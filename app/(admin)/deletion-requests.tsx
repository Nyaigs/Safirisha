import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

type DeletionRequest = {
  id: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    plateNumber: string;
    vehicleType: string;
    user: {
      id: string;
      fullName: string;
      username?: string | null;
      email: string;
      phone: string;
      isActive: boolean;
      isSuperAdmin?: boolean;
    };
  };
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusColors(status: DeletionRequest["status"]) {
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

export default function DeletionRequestsScreen() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const data = await apiFetch("/admin/deletion-requests");
    setRequests(data.deletionRequests || []);
  }, []);

  useEffect(() => {
    fetchRequests()
      .catch((error: any) => {
        Alert.alert(
          "Load failed",
          error?.message || "Could not load deletion requests",
        );
      })
      .finally(() => setLoading(false));
  }, [fetchRequests]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchRequests();
    } finally {
      setRefreshing(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      setActingId(requestId);

      await apiFetch(`/admin/deletion-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "APPROVED",
          adminNote: "Approved by admin",
        }),
      });

      Alert.alert("Success", "Deletion request approved.");
      await fetchRequests();
    } catch (error: any) {
      Alert.alert(
        "Action failed",
        error?.message || "Could not approve request",
      );
    } finally {
      setActingId(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      setActingId(requestId);

      await apiFetch(`/admin/deletion-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "REJECTED",
          adminNote: "Rejected by admin",
        }),
      });

      Alert.alert("Success", "Deletion request rejected.");
      await fetchRequests();
    } catch (error: any) {
      Alert.alert(
        "Action failed",
        error?.message || "Could not reject request",
      );
    } finally {
      setActingId(null);
    }
  };

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0B8F47" size="large" />
        <Text style={styles.loadingText}>Loading deletion requests...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={requests}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <MaterialCommunityIcons
                name="account-remove-outline"
                size={26}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Deletion Requests</Text>
              <Text style={styles.subtitle}>
                Review driver account removal requests and resolve them safely.
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Total" value={stats.total} dark />
            <StatCard label="Pending" value={stats.pending} warning />
            <StatCard label="Approved" value={stats.approved} success />
            <StatCard label="Rejected" value={stats.rejected} danger />
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="archive-outline" size={28} color="#0B8F47" />
          </View>
          <Text style={styles.emptyTitle}>No deletion requests</Text>
          <Text style={styles.emptyText}>
            Driver deletion requests will appear here when submitted.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const statusColors = getStatusColors(item.status);
        const isActing = actingId === item.id;
        const canAct = item.status === "PENDING";

        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTopInfo}>
                <Text style={styles.name}>{item.driver.user.fullName}</Text>
                <Text style={styles.meta}>{item.driver.user.email}</Text>
                <Text style={styles.meta}>{item.driver.user.phone}</Text>
                <Text style={styles.subMeta}>
                  {item.driver.vehicleType} • {item.driver.plateNumber}
                </Text>
              </View>

              <Text
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusColors.bg,
                    color: statusColors.text,
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>

            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{item.reason}</Text>

            {item.adminNote ? (
              <>
                <Text style={styles.reasonLabel}>Admin Note</Text>
                <Text style={styles.adminNoteText}>{item.adminNote}</Text>
              </>
            ) : null}

            <Text style={styles.timeText}>
              Created: {formatDate(item.createdAt)}
            </Text>
            <Text style={styles.timeText}>
              Updated: {formatDate(item.updatedAt)}
            </Text>

            {canAct ? (
              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.approveBtn, isActing && styles.disabledBtn]}
                  onPress={() => approveRequest(item.id)}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Approve</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.rejectBtn, isActing && styles.disabledBtn]}
                  onPress={() => rejectRequest(item.id)}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Reject</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

function StatCard({
  label,
  value,
  dark,
  warning,
  success,
  danger,
}: {
  label: string;
  value: number;
  dark?: boolean;
  warning?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  let backgroundColor = "#FFFFFF";
  let borderColor = "#E5E7EB";
  let textColor = "#111111";

  if (dark) {
    backgroundColor = "#111111";
    borderColor = "#111111";
    textColor = "#FFFFFF";
  }

  if (warning) {
    backgroundColor = "#FEF3C7";
    borderColor = "#FDE68A";
    textColor = "#B45309";
  }

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

  return (
    <View style={[styles.statCard, { backgroundColor, borderColor }]}>
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statText, { color: textColor }]}>{label}</Text>
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
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  headerIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
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
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 72,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  cardTopInfo: {
    flex: 1,
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
    marginBottom: 3,
  },
  subMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#111111",
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  reasonLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 6,
  },
  reasonText: {
    fontSize: 14,
    color: "#111111",
    fontWeight: "700",
    lineHeight: 20,
  },
  adminNoteText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  timeText: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#0B8F47",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#C8102E",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
