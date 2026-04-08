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

type PendingDriver = {
  id: string;
  plateNumber: string;
  vehicleType: string;
  vehicleImageUrl?: string;
  ownershipProofUrl?: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  availability: "OFFLINE" | "ONLINE" | "BUSY";
  createdAt: string;
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

export default function PendingDriversScreen() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchPendingDrivers = useCallback(async () => {
    const data = await apiFetch("/admin/drivers/pending");
    setDrivers(Array.isArray(data?.drivers) ? data.drivers : []);
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchPendingDrivers()
      .catch((error: any) => {
        Alert.alert(
          "Load failed",
          error?.message || "Could not load pending drivers",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fetchPendingDrivers]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchPendingDrivers();
    } finally {
      setRefreshing(false);
    }
  };

  const approveDriver = async (driverId: string) => {
    try {
      setActingId(driverId);

      await apiFetch(`/admin/drivers/${driverId}/approval`, {
        method: "PATCH",
        body: {
          approvalStatus: "APPROVED",
        },
      });

      Alert.alert("Success", "Driver approved successfully.");
      await fetchPendingDrivers();
    } catch (error: any) {
      Alert.alert(
        "Approval failed",
        error?.message || "Could not approve driver",
      );
    } finally {
      setActingId(null);
    }
  };

  const rejectDriver = async (driverId: string) => {
    try {
      setActingId(driverId);

      await apiFetch(`/admin/drivers/${driverId}/approval`, {
        method: "PATCH",
        body: {
          approvalStatus: "REJECTED",
        },
      });

      Alert.alert("Success", "Driver rejected successfully.");
      await fetchPendingDrivers();
    } catch (error: any) {
      Alert.alert(
        "Rejection failed",
        error?.message || "Could not reject driver",
      );
    } finally {
      setActingId(null);
    }
  };

  const totalPending = useMemo(() => drivers.length, [drivers]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0B8F47" size="large" />
        <Text style={styles.loadingText}>Loading pending drivers...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={drivers}
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
                name="clipboard-check-outline"
                size={26}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Pending Drivers</Text>
              <Text style={styles.subtitle}>
                Review and approve new drivers before they go live on Safirisha.
              </Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalPending}</Text>
            <Text style={styles.statLabel}>Pending approvals</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="checkmark-done-outline" size={28} color="#0B8F47" />
          </View>
          <Text style={styles.emptyTitle}>No pending drivers</Text>
          <Text style={styles.emptyText}>
            New driver applications waiting for review will appear here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isActing = actingId === item.id;

        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.user.fullName?.charAt(0)?.toUpperCase() || "D"}
                </Text>
              </View>

              <View style={styles.cardTopInfo}>
                <Text style={styles.name}>{item.user.fullName}</Text>
                <Text style={styles.meta}>{item.user.email}</Text>
                <Text style={styles.meta}>{item.user.phone}</Text>
                <Text style={styles.username}>
                  @{item.user.username || "no_username"}
                </Text>
              </View>

              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>PENDING</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <InfoBox label="Vehicle Type" value={item.vehicleType} />
              <InfoBox label="Plate Number" value={item.plateNumber} />
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Availability</Text>
              <Text style={styles.infoValue}>{item.availability}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.approveBtn, isActing && styles.disabledBtn]}
                onPress={() => approveDriver(item.id)}
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
                onPress={() => rejectDriver(item.id)}
                disabled={isActing}
              >
                {isActing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoBoxLabel}>{label}</Text>
      <Text style={styles.infoBoxValue}>{value}</Text>
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
  statCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "700",
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
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#0B8F47",
    fontWeight: "900",
    fontSize: 20,
  },
  cardTopInfo: {
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
    marginBottom: 3,
  },
  username: {
    marginTop: 4,
    color: "#0B8F47",
    fontWeight: "800",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingBadgeText: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "900",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  infoBoxLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoBoxValue: {
    fontSize: 14,
    color: "#111111",
    fontWeight: "800",
  },
  infoRow: {
    marginBottom: 14,
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
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
