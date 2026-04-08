import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";

type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";
type DriverApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type DriverAvailability = "OFFLINE" | "ONLINE" | "BUSY";
type RoleFilter = "CUSTOMER" | "DRIVER" | "ADMIN";
type DriverApprovalFilter = "ALL" | "PENDING" | "APPROVED";

type AdminUser = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  isSuperAdmin?: boolean;
  createdAt?: string;
  driverProfile?: {
    approvalStatus?: DriverApprovalStatus;
    availability?: DriverAvailability;
    vehicleType?: string;
    plateNumber?: string;
  } | null;
};

function normalizeRoleFilter(value?: string | string[]): RoleFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw || "CUSTOMER").toUpperCase();

  if (normalized === "DRIVER") return "DRIVER";
  if (normalized === "ADMIN") return "ADMIN";
  return "CUSTOMER";
}

function normalizeDriverApprovalFilter(
  value?: string | string[],
): DriverApprovalFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw || "ALL").toUpperCase();

  if (normalized === "PENDING") return "PENDING";
  if (normalized === "APPROVED") return "APPROVED";
  return "ALL";
}

function getAvailabilityColors(status?: string) {
  switch (status) {
    case "ONLINE":
      return { bg: "#dbeafe", text: "#1d4ed8" };
    case "BUSY":
      return { bg: "#dcfce7", text: "#166534" };
    case "OFFLINE":
      return { bg: "#f3f4f6", text: "#374151" };
    default:
      return { bg: "#e5e7eb", text: "#111827" };
  }
}

function getApprovalColors(status?: string) {
  switch (status) {
    case "APPROVED":
      return { bg: "#dcfce7", text: "#166534" };
    case "REJECTED":
      return { bg: "#fee2e2", text: "#b91c1c" };
    case "PENDING":
      return { bg: "#fef3c7", text: "#b45309" };
    default:
      return { bg: "#e5e7eb", text: "#111827" };
  }
}

export default function AdminUsersScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    driverApproval?: string;
  }>();

  const currentRoleFilter = normalizeRoleFilter(params.role);
  const currentDriverApprovalFilter = normalizeDriverApprovalFilter(
    params.driverApproval,
  );

  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/users");
      setAllUsers(
        Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [],
      );
    } catch (error) {
      console.log("Failed to fetch users:", error);
      setAllUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers]),
  );

  useEffect(() => {
    const socket = connectSocket();

    const onAdminStatsUpdated = () => {
      fetchUsers();
    };

    socket.on("admin_stats_updated", onAdminStatsUpdated);

    return () => {
      socket.off("admin_stats_updated", onAdminStatsUpdated);
    };
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const stats = useMemo(() => {
    const customers = allUsers.filter((u) => u.role === "CUSTOMER").length;
    const drivers = allUsers.filter((u) => u.role === "DRIVER").length;
    const admins = allUsers.filter((u) => u.role === "ADMIN").length;
    const active = allUsers.filter((u) => u.isActive).length;
    const suspended = allUsers.filter((u) => !u.isActive).length;

    const onlineDrivers = allUsers.filter(
      (u) => u.role === "DRIVER" && u.driverProfile?.availability === "ONLINE",
    ).length;

    const pendingDrivers = allUsers.filter(
      (u) =>
        u.role === "DRIVER" && u.driverProfile?.approvalStatus === "PENDING",
    ).length;

    const approvedDrivers = allUsers.filter(
      (u) =>
        u.role === "DRIVER" && u.driverProfile?.approvalStatus === "APPROVED",
    ).length;

    return {
      customers,
      drivers,
      admins,
      active,
      suspended,
      onlineDrivers,
      pendingDrivers,
      approvedDrivers,
    };
  }, [allUsers]);

  const roleFilteredUsers = useMemo(() => {
    return allUsers.filter((user) => user.role === currentRoleFilter);
  }, [allUsers, currentRoleFilter]);

  const driverFilteredUsers = useMemo(() => {
    if (currentRoleFilter !== "DRIVER") return roleFilteredUsers;
    if (currentDriverApprovalFilter === "ALL") return roleFilteredUsers;

    return roleFilteredUsers.filter(
      (user) =>
        user.driverProfile?.approvalStatus === currentDriverApprovalFilter,
    );
  }, [currentRoleFilter, currentDriverApprovalFilter, roleFilteredUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return driverFilteredUsers.filter((user) => {
      if (!q) return true;

      const haystack = [
        user.fullName,
        user.username ?? "",
        user.email,
        user.phone,
        user.role,
        user.driverProfile?.approvalStatus ?? "",
        user.driverProfile?.availability ?? "",
        user.driverProfile?.vehicleType ?? "",
        user.driverProfile?.plateNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [search, driverFilteredUsers]);

  const screenTitle =
    currentRoleFilter === "CUSTOMER"
      ? "Customer Accounts"
      : currentRoleFilter === "ADMIN"
        ? "Admin Accounts"
        : currentDriverApprovalFilter === "PENDING"
          ? "Pending Drivers"
          : currentDriverApprovalFilter === "APPROVED"
            ? "Approved Drivers"
            : "Driver Accounts";

  const screenSubtitle =
    currentRoleFilter === "CUSTOMER"
      ? "Review customer accounts and open customer records for actions."
      : currentRoleFilter === "ADMIN"
        ? "Review admin accounts and management access."
        : currentDriverApprovalFilter === "PENDING"
          ? "Review drivers waiting for approval and open details to approve or reject."
          : currentDriverApprovalFilter === "APPROVED"
            ? "Review approved drivers, availability, and vehicle details."
            : "Review all driver accounts, approvals, and live availability.";

  const goToRolePage = (role: RoleFilter) => {
    router.replace({
      pathname: "/(admin)/users",
      params: { role },
    });
  };

  const goToDriverApprovalPage = (approval: DriverApprovalFilter) => {
    if (approval === "ALL") {
      router.replace({
        pathname: "/(admin)/users",
        params: { role: "DRIVER" },
      });
      return;
    }

    router.replace({
      pathname: "/(admin)/users",
      params: { role: "DRIVER", driverApproval: approval },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading users center...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={24} color="#fff" />
          </View>

          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{screenTitle}</Text>
            <Text style={styles.heroSubtitle}>{screenSubtitle}</Text>
          </View>
        </View>

        <View style={styles.statsStrip}>
          <StatPill label="Active" value={stats.active} />
          <StatPill label="Suspended" value={stats.suspended} />
          {currentRoleFilter === "DRIVER" ? (
            <>
              <StatPill label="Pending" value={stats.pendingDrivers} />
              <StatPill label="Approved" value={stats.approvedDrivers} />
            </>
          ) : null}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            placeholder="Search by name, username, email, phone, plate..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>User Categories</Text>
      <View style={styles.grid}>
        <FilterCard
          title="Customers"
          subtitle="Client accounts"
          value={stats.customers}
          icon="person-outline"
          active={currentRoleFilter === "CUSTOMER"}
          onPress={() => goToRolePage("CUSTOMER")}
        />
        <FilterCard
          title="Drivers"
          subtitle={`${stats.onlineDrivers} online • ${stats.pendingDrivers} pending`}
          value={stats.drivers}
          icon="car-outline"
          active={currentRoleFilter === "DRIVER"}
          onPress={() => goToRolePage("DRIVER")}
        />
        <FilterCard
          title="Admins"
          subtitle="Management accounts"
          value={stats.admins}
          icon="shield-checkmark-outline"
          active={currentRoleFilter === "ADMIN"}
          onPress={() => goToRolePage("ADMIN")}
        />
        <FilterCard
          title="Pending Drivers"
          subtitle="Open approval queue"
          value={stats.pendingDrivers}
          icon="time-outline"
          active={
            currentRoleFilter === "DRIVER" &&
            currentDriverApprovalFilter === "PENDING"
          }
          onPress={() => goToDriverApprovalPage("PENDING")}
        />
      </View>

      {currentRoleFilter === "DRIVER" ? (
        <>
          <Text style={styles.sectionTitle}>Driver Status</Text>
          <View style={styles.grid}>
            <StatusCard
              title="Pending Drivers"
              subtitle="Drivers waiting for approval"
              value={stats.pendingDrivers}
              icon="time-outline"
              bg="#fef3c7"
              textColor="#b45309"
              active={currentDriverApprovalFilter === "PENDING"}
              onPress={() => goToDriverApprovalPage("PENDING")}
            />
            <StatusCard
              title="Approved Drivers"
              subtitle="Drivers ready for platform activity"
              value={stats.approvedDrivers}
              icon="checkmark-circle-outline"
              bg="#dcfce7"
              textColor="#166534"
              active={currentDriverApprovalFilter === "APPROVED"}
              onPress={() => goToDriverApprovalPage("APPROVED")}
            />
          </View>

          {currentDriverApprovalFilter !== "ALL" ? (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => goToDriverApprovalPage("ALL")}
              activeOpacity={0.88}
            >
              <Ionicons name="close-circle-outline" size={18} color="#0f172a" />
              <Text style={styles.clearFilterButtonText}>Show All Drivers</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        <ActionCard
          title="Create User"
          subtitle="Add customer, driver, or admin"
          icon="person-add-outline"
          dark
          onPress={() => router.push("/(admin)/create-user")}
        />
        <ActionCard
          title="Live Map"
          subtitle="Track active drivers"
          icon="map-outline"
          onPress={() => router.push("/(admin)/live-map")}
        />
      </View>

      <Text style={styles.sectionTitle}>{screenTitle}</Text>

      {filteredUsers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={30} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyText}>
            Try another search term, or switch the current filter.
          </Text>
        </View>
      ) : (
        <View style={styles.userCardsWrap}>
          {filteredUsers.map((item) => {
            const availabilityColors = getAvailabilityColors(
              item.driverProfile?.availability,
            );
            const approvalColors = getApprovalColors(
              item.driverProfile?.approvalStatus,
            );

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.userCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/user-details",
                    params: { userId: item.id },
                  })
                }
              >
                <View style={styles.userTop}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {item.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </Text>
                  </View>

                  <View style={styles.userMain}>
                    <Text style={styles.userName}>{item.fullName}</Text>
                    <Text style={styles.userRole}>{item.role}</Text>
                    <Text style={styles.userMeta}>{item.email}</Text>
                    <Text style={styles.userMeta}>{item.phone}</Text>
                    {item.username ? (
                      <Text style={styles.username}>@{item.username}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.badgesRow}>
                  <Text
                    style={[
                      styles.badge,
                      item.isActive
                        ? styles.activeBadge
                        : styles.suspendedBadge,
                    ]}
                  >
                    {item.isActive ? "ACTIVE" : "SUSPENDED"}
                  </Text>

                  {item.isSuperAdmin ? (
                    <Text style={[styles.badge, styles.superBadge]}>
                      SUPER ADMIN
                    </Text>
                  ) : null}

                  {item.role === "DRIVER" ? (
                    <>
                      <Text
                        style={[
                          styles.badge,
                          {
                            backgroundColor: approvalColors.bg,
                            color: approvalColors.text,
                          },
                        ]}
                      >
                        {item.driverProfile?.approvalStatus || "PENDING"}
                      </Text>

                      <Text
                        style={[
                          styles.badge,
                          {
                            backgroundColor: availabilityColors.bg,
                            color: availabilityColors.text,
                          },
                        ]}
                      >
                        {item.driverProfile?.availability || "OFFLINE"}
                      </Text>
                    </>
                  ) : null}
                </View>

                {item.role === "DRIVER" ? (
                  <View style={styles.driverInfoWrap}>
                    <InfoMini
                      label="Vehicle"
                      value={item.driverProfile?.vehicleType || "—"}
                    />
                    <InfoMini
                      label="Plate"
                      value={item.driverProfile?.plateNumber || "—"}
                    />
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Open user details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#64748b" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

function FilterCard({
  title,
  subtitle,
  value,
  icon,
  active,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterCard, active && styles.filterCardActive]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View
        style={[styles.filterIconWrap, active && styles.filterIconWrapActive]}
      >
        <Ionicons name={icon} size={22} color={active ? "#fff" : "#0f172a"} />
      </View>
      <Text style={[styles.filterTitle, active && styles.filterTitleActive]}>
        {title}
      </Text>
      <Text style={[styles.filterValue, active && styles.filterValueActive]}>
        {value}
      </Text>
      <Text
        style={[styles.filterSubtitle, active && styles.filterSubtitleActive]}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function StatusCard({
  title,
  subtitle,
  value,
  icon,
  bg,
  textColor,
  active,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  textColor: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.statusCard,
        { backgroundColor: bg },
        active && styles.statusCardActive,
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Ionicons name={icon} size={22} color={textColor} />
      <Text style={[styles.statusCardTitle, { color: textColor }]}>
        {title}
      </Text>
      <Text style={[styles.statusCardValue, { color: textColor }]}>
        {value}
      </Text>
      <Text style={[styles.statusCardSubtitle, { color: textColor }]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  dark,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, dark && styles.actionCardDark]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View
        style={[styles.actionIconCircle, dark && styles.actionIconCircleDark]}
      >
        <Ionicons name={icon} size={22} color={dark ? "#fff" : "#0f172a"} />
      </View>
      <Text style={[styles.actionTitle, dark && styles.actionTitleDark]}>
        {title}
      </Text>
      <Text style={[styles.actionSubtitle, dark && styles.actionSubtitleDark]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoMini}>
      <Text style={styles.infoMiniLabel}>{label}</Text>
      <Text style={styles.infoMiniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#475569",
  },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "#64748b",
    lineHeight: 20,
  },

  statsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statPill: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statPillValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  statPillLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "800",
  },

  searchWrap: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 8,
    color: "#0f172a",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
    marginTop: 4,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  filterCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    minHeight: 158,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterCardActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  filterIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  filterIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
    marginTop: 12,
  },
  filterTitleActive: {
    color: "#fff",
  },
  filterValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    marginTop: 6,
  },
  filterValueActive: {
    color: "#fff",
  },
  filterSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    color: "#64748b",
    marginTop: 4,
  },
  filterSubtitleActive: {
    color: "#d1d5db",
  },

  statusCard: {
    width: "48%",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    minHeight: 150,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusCardActive: {
    borderColor: "#0f172a",
    borderWidth: 2,
  },
  statusCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  statusCardValue: {
    fontSize: 30,
    fontWeight: "900",
  },
  statusCardSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  clearFilterButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  clearFilterButtonText: {
    color: "#0f172a",
    fontWeight: "900",
  },

  actionCard: {
    width: "48%",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    minHeight: 145,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  actionCardDark: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconCircleDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  actionTitleDark: {
    color: "#fff",
  },
  actionSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    color: "#64748b",
  },
  actionSubtitleDark: {
    color: "#d1d5db",
  },

  userCardsWrap: {
    marginTop: 2,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  userTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#3730a3",
  },
  userMain: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 3,
  },
  userRole: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 6,
  },
  userMeta: {
    color: "#475569",
    marginBottom: 3,
  },
  username: {
    marginTop: 4,
    color: "#0f766e",
    fontWeight: "800",
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  activeBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  suspendedBadge: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
  superBadge: {
    backgroundColor: "#111827",
    color: "#fff",
  },

  driverInfoWrap: {
    flexDirection: "row",
    gap: 10,
  },
  infoMini: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  infoMiniLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoMiniValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },

  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  cardFooterText: {
    color: "#64748b",
    fontWeight: "800",
    fontSize: 12,
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    textAlign: "center",
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    lineHeight: 20,
  },
});
