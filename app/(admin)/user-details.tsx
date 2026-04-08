import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiFetch } from "../../lib/api";

type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";
type DriverApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type DriverAvailability = "OFFLINE" | "ONLINE" | "BUSY";

type UserDetails = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  isSuperAdmin?: boolean;
  suspensionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  driverProfile?: {
    id: string;
    plateNumber?: string;
    vehicleType?: string;
    approvalStatus?: DriverApprovalStatus;
    availability?: DriverAvailability;
    currentLat?: number | null;
    currentLng?: number | null;
    lastLocationAt?: string | null;
  } | null;
  customerRequests?: {
    id: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    status?: string;
    estimatedPrice?: number;
    createdAt?: string;
  }[];
};

function getAvailabilityPillStyle(availability?: DriverAvailability) {
  switch (availability) {
    case "ONLINE":
      return { backgroundColor: "#dbeafe", color: "#1d4ed8" };
    case "BUSY":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    case "OFFLINE":
    default:
      return { backgroundColor: "#e5e7eb", color: "#374151" };
  }
}

function getApprovalPillStyle(status?: DriverApprovalStatus) {
  switch (status) {
    case "APPROVED":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    case "REJECTED":
      return { backgroundColor: "#fee2e2", color: "#b91c1c" };
    case "PENDING":
    default:
      return { backgroundColor: "#fef3c7", color: "#b45309" };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatCoord(value?: number | null) {
  if (typeof value !== "number") return "—";
  return value.toFixed(6);
}

function formatMoney(value?: number | null) {
  return `KES ${Number(value ?? 0).toLocaleString()}`;
}

function getInitials(name?: string | null) {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "NA";
}

export default function UserDetailsScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await apiFetch(`/admin/users/${userId}`);
      setUser(res?.user ?? null);
    } catch (error) {
      console.log("Fetch user failed:", error);
      Alert.alert("Error", "Failed to load user details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const joinedDate = useMemo(
    () => formatDate(user?.createdAt),
    [user?.createdAt],
  );
  const updatedDate = useMemo(
    () => formatDate(user?.updatedAt),
    [user?.updatedAt],
  );

  const handleSuspendOrReactivate = async () => {
    if (!user) return;

    try {
      setActionLoading(true);

      if (user.isActive) {
        await apiFetch(`/admin/users/${user.id}/suspend`, {
          method: "PATCH",
          body: {
            reason: "Suspended by admin",
          },
        });
        Alert.alert("Success", "User suspended successfully");
      } else {
        await apiFetch(`/admin/users/${user.id}/reactivate`, {
          method: "PATCH",
        });
        Alert.alert("Success", "User reactivated successfully");
      }

      await fetchUser();
    } catch (error: any) {
      console.log("Status action failed:", error);
      Alert.alert("Action failed", error?.message || "Could not update user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDriverApproval = async (
    approvalStatus: "APPROVED" | "REJECTED",
  ) => {
    if (!user?.driverProfile?.id) return;

    try {
      setActionLoading(true);

      await apiFetch(`/admin/drivers/${user.driverProfile.id}/approval`, {
        method: "PATCH",
        body: { approvalStatus },
      });

      Alert.alert(
        "Success",
        `Driver ${approvalStatus.toLowerCase()} successfully`,
      );
      await fetchUser();
    } catch (error: any) {
      console.log("Driver approval update failed:", error);
      Alert.alert(
        "Action failed",
        error?.message || "Could not update driver approval",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading user...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>User not found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availabilityPill = getAvailabilityPillStyle(
    user.driverProfile?.availability,
  );
  const approvalPill = getApprovalPillStyle(user.driverProfile?.approvalStatus);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchUser();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>User Details</Text>
          <Text style={styles.headerSubtitle}>Premium admin profile view</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>
            {getInitials(user.fullName)}
          </Text>
        </View>

        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.role}>{user.role}</Text>

        <View style={styles.pillsWrap}>
          <View
            style={[
              styles.statusPill,
              user.isActive ? styles.activePill : styles.inactivePill,
            ]}
          >
            <Text style={styles.statusPillText}>
              {user.isActive ? "ACTIVE" : "SUSPENDED"}
            </Text>
          </View>

          {user.role === "DRIVER" && user.driverProfile ? (
            <>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: availabilityPill.backgroundColor },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: availabilityPill.color },
                  ]}
                >
                  {user.driverProfile.availability || "OFFLINE"}
                </Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: approvalPill.backgroundColor },
                ]}
              >
                <Text
                  style={[styles.statusPillText, { color: approvalPill.color }]}
                >
                  {user.driverProfile.approvalStatus || "PENDING"}
                </Text>
              </View>
            </>
          ) : null}

          {user.isSuperAdmin ? (
            <View style={[styles.statusPill, styles.superPill]}>
              <Text style={[styles.statusPillText, { color: "#fff" }]}>
                SUPER ADMIN
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroMetaGrid}>
          <MiniMeta label="Email" value={user.email} />
          <MiniMeta label="Phone" value={user.phone} />
          <MiniMeta label="Username" value={user.username || "—"} />
          <MiniMeta label="Joined" value={joinedDate} />
        </View>
      </View>

      <SectionCard title="Account Info" icon="person-circle-outline">
        <InfoCard
          rows={[
            ["Email", user.email],
            ["Phone", user.phone],
            ["Username", user.username || "—"],
            ["Role", user.role],
            ["Account Status", user.isActive ? "ACTIVE" : "SUSPENDED"],
            ["Super Admin", user.isSuperAdmin ? "Yes" : "No"],
            ["Joined", joinedDate],
            ["Last Updated", updatedDate],
            ["Suspension Reason", user.suspensionReason || "—"],
          ]}
        />
      </SectionCard>

      {user.role === "DRIVER" && user.driverProfile ? (
        <SectionCard title="Driver Profile" icon="car-sport-outline">
          <InfoCard
            rows={[
              ["Plate Number", user.driverProfile.plateNumber || "—"],
              ["Vehicle Type", user.driverProfile.vehicleType || "—"],
              [
                "Driver Approval",
                user.driverProfile.approvalStatus || "PENDING",
              ],
              [
                "Driver Availability",
                user.driverProfile.availability || "OFFLINE",
              ],
              ["Current Latitude", formatCoord(user.driverProfile.currentLat)],
              ["Current Longitude", formatCoord(user.driverProfile.currentLng)],
              [
                "Last Location Update",
                formatDate(user.driverProfile.lastLocationAt),
              ],
            ]}
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Admin Actions" icon="flash-outline">
        <TouchableOpacity
          style={[
            styles.actionButton,
            user.isActive ? styles.suspendButton : styles.reactivateButton,
          ]}
          onPress={handleSuspendOrReactivate}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={
                  user.isActive ? "ban-outline" : "checkmark-circle-outline"
                }
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                {user.isActive ? "Suspend User" : "Reactivate User"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {user.role === "DRIVER" &&
        user.driverProfile &&
        user.driverProfile.approvalStatus !== "APPROVED" ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleDriverApproval("APPROVED")}
            disabled={actionLoading}
          >
            <Ionicons name="thumbs-up-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Approve Driver</Text>
          </TouchableOpacity>
        ) : null}

        {user.role === "DRIVER" &&
        user.driverProfile &&
        user.driverProfile.approvalStatus !== "REJECTED" ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleDriverApproval("REJECTED")}
            disabled={actionLoading}
          >
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Reject Driver</Text>
          </TouchableOpacity>
        ) : null}
      </SectionCard>

      {user.role === "CUSTOMER" ? (
        <SectionCard title="Recent Customer Requests" icon="receipt-outline">
          {!user.customerRequests || user.customerRequests.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Text style={styles.historyEmptyText}>No recent requests.</Text>
            </View>
          ) : (
            user.customerRequests.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyTopRow}>
                  <View style={styles.historyIconWrap}>
                    <MaterialCommunityIcons
                      name="truck-fast-outline"
                      size={18}
                      color="#0f172a"
                    />
                  </View>

                  <View style={styles.historyContent}>
                    <Text style={styles.historyRoute}>
                      {item.pickupAddress || "Unknown pickup"} →{" "}
                      {item.dropoffAddress || "Unknown drop-off"}
                    </Text>
                    <Text style={styles.historyDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.historyMetaRow}>
                  <View style={styles.historyPill}>
                    <Text style={styles.historyPillText}>
                      {item.status || "—"}
                    </Text>
                  </View>

                  <Text style={styles.historyPrice}>
                    {formatMoney(item.estimatedPrice)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color="#0f172a" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoCard({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([label, value], index) => (
        <View
          key={label}
          style={[
            styles.infoRow,
            index === rows.length - 1 && styles.infoRowLast,
          ]}
        >
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetaCard}>
      <Text style={styles.miniMetaLabel}>{label}</Text>
      <Text style={styles.miniMetaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingBottom: 32,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f3f4f6",
  },
  loadingText: {
    marginTop: 10,
    color: "#475569",
  },
  emptyText: {
    fontSize: 16,
    color: "#475569",
    marginBottom: 12,
  },

  header: {
    backgroundColor: "#0b1220",
    paddingTop: 62,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBack: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#182235",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    margin: 16,
    marginBottom: 14,
  },
  heroAvatar: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroAvatarText: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
  },
  name: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  role: {
    color: "#64748b",
    fontWeight: "700",
    marginTop: 4,
  },
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginHorizontal: 4,
    marginTop: 8,
  },
  activePill: {
    backgroundColor: "#dcfce7",
  },
  inactivePill: {
    backgroundColor: "#fee2e2",
  },
  superPill: {
    backgroundColor: "#111827",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },

  heroMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
    width: "100%",
  },
  miniMetaCard: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  miniMetaLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    marginBottom: 4,
  },
  miniMetaValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 18,
  },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginHorizontal: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
    lineHeight: 20,
  },

  actionButton: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexDirection: "row",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    marginLeft: 8,
  },
  suspendButton: {
    backgroundColor: "#dc2626",
  },
  reactivateButton: {
    backgroundColor: "#15803d",
  },
  approveButton: {
    backgroundColor: "#16a34a",
  },
  rejectButton: {
    backgroundColor: "#b91c1c",
  },

  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  historyContent: {
    flex: 1,
  },
  historyRoute: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    lineHeight: 20,
  },
  historyDate: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  historyMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyPill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyPillText: {
    color: "#4338CA",
    fontSize: 12,
    fontWeight: "900",
  },
  historyPrice: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 14,
  },
  historyEmpty: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
  },
  historyEmptyText: {
    textAlign: "center",
    color: "#64748b",
    fontWeight: "700",
  },

  backButton: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
