import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
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
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../store/auth";

type DriverApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type DriverAvailability = "OFFLINE" | "ONLINE" | "BUSY";

type DriverProfileResponse = {
  id?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  role?: "CUSTOMER" | "DRIVER" | "ADMIN";
  plateNumber?: string | null;
  vehicleType?: string | null;
  vehicleImageUrl?: string | null;
  ownershipProofUrl?: string | null;
  approvalStatus?: DriverApprovalStatus;
  availability?: DriverAvailability;
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
  suspensionReason?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function buildInitialProfile(): DriverProfileResponse | null {
  const authUser = useAuthStore.getState().user;
  if (!authUser?.driverProfile) return null;

  return {
    id: authUser.driverProfile.id,
    fullName: authUser.fullName,
    email: authUser.email,
    phone: authUser.phone,
    role: authUser.role,
    plateNumber: authUser.driverProfile.plateNumber,
    vehicleType: authUser.driverProfile.vehicleType,
    vehicleImageUrl: authUser.driverProfile.vehicleImageUrl ?? null,
    ownershipProofUrl: authUser.driverProfile.ownershipProofUrl ?? null,
    approvalStatus:
      (authUser.driverProfile.approvalStatus as DriverApprovalStatus) ??
      "PENDING",
    availability:
      (authUser.driverProfile.availability as DriverAvailability) ?? "OFFLINE",
    currentLat: authUser.driverProfile.currentLat ?? null,
    currentLng: authUser.driverProfile.currentLng ?? null,
    currentHeading: authUser.driverProfile.currentHeading ?? null,
    currentSpeed: authUser.driverProfile.currentSpeed ?? null,
    lastLocationAt: authUser.driverProfile.lastLocationAt ?? null,
  };
}

function syncDriverIntoStore(driver: DriverProfileResponse) {
  const state = useAuthStore.getState();
  const authUser = state.user;
  if (!authUser) return;

  state.setUser({
    ...authUser,
    fullName: driver.fullName ?? authUser.fullName,
    email: driver.email ?? authUser.email,
    phone: driver.phone ?? authUser.phone,
    role: (driver.role as "CUSTOMER" | "DRIVER" | "ADMIN") ?? authUser.role,
    driverProfile: {
      id: driver.id ?? authUser.driverProfile?.id ?? "",
      plateNumber:
        driver.plateNumber ?? authUser.driverProfile?.plateNumber ?? "",
      vehicleType:
        driver.vehicleType ?? authUser.driverProfile?.vehicleType ?? "",
      vehicleImageUrl:
        driver.vehicleImageUrl ?? authUser.driverProfile?.vehicleImageUrl,
      ownershipProofUrl:
        driver.ownershipProofUrl ?? authUser.driverProfile?.ownershipProofUrl,
      approvalStatus:
        driver.approvalStatus ?? authUser.driverProfile?.approvalStatus,
      availability: driver.availability ?? authUser.driverProfile?.availability,
      currentLat: driver.currentLat ?? null,
      currentLng: driver.currentLng ?? null,
      currentHeading: driver.currentHeading ?? null,
      currentSpeed: driver.currentSpeed ?? null,
      lastLocationAt: driver.lastLocationAt ?? null,
    },
  });
}

async function reverseLocationName(lat: number, lng: number) {
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    const place = places?.[0];
    if (!place) return "Location available";

    const parts = [
      place.name,
      place.street,
      place.district,
      place.city,
      place.region,
    ].filter(Boolean);

    return parts.length ? parts.join(", ") : "Location available";
  } catch {
    return "Location available";
  }
}

function SectionRow({
  icon,
  title,
  subtitle,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <TouchableOpacity style={styles.rowCard} onPress={onPress}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={20} color="#111827" />
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.rowRight}>
        {badge ? (
          <View style={styles.rowBadge}>
            <Text style={styles.rowBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );
}

export default function DriverProfileScreen() {
  const auth = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<DriverProfileResponse | null>(
    buildInitialProfile,
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [locationLabel, setLocationLabel] = useState("Location not available");

  const fetchProfile = useCallback(async () => {
    try {
      setErrorMsg("");

      const response = await apiFetch("/drivers/me");
      const data = response?.driver ?? response ?? {};
      const authUser = useAuthStore.getState().user;

      const normalized: DriverProfileResponse = {
        id: data.id ?? authUser?.driverProfile?.id,
        userId: data.userId,
        fullName: data.fullName ?? authUser?.fullName ?? "Driver",
        email: data.email ?? authUser?.email ?? "",
        phone: data.phone ?? authUser?.phone ?? null,
        role: data.role ?? authUser?.role ?? "DRIVER",
        plateNumber: data.plateNumber ?? null,
        vehicleType: data.vehicleType ?? null,
        vehicleImageUrl: data.vehicleImageUrl ?? null,
        ownershipProofUrl: data.ownershipProofUrl ?? null,
        approvalStatus: data.approvalStatus ?? "PENDING",
        availability: data.availability ?? "OFFLINE",
        currentLat: data.currentLat ?? null,
        currentLng: data.currentLng ?? null,
        currentHeading: data.currentHeading ?? null,
        currentSpeed: data.currentSpeed ?? null,
        lastLocationAt: data.lastLocationAt ?? null,
        suspensionReason: data.suspensionReason ?? null,
        isActive: data.isActive ?? true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      setProfile(normalized);
      syncDriverIntoStore(normalized);

      if (
        typeof normalized.currentLat === "number" &&
        typeof normalized.currentLng === "number"
      ) {
        const readable = await reverseLocationName(
          normalized.currentLat,
          normalized.currentLng,
        );
        setLocationLabel(readable);
      } else {
        setLocationLabel("Location not available");
      }
    } catch (error) {
      console.error("Failed to fetch driver profile", error);
      setErrorMsg("Could not load your profile right now.");
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      await fetchProfile();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
  }, [loadProfile]);

  const approvalStatus = profile?.approvalStatus ?? "PENDING";
  const accountStatusText =
    profile?.isActive === false ? "Suspended" : "Active";
  const availability = profile?.availability ?? "OFFLINE";

  const approvalBadgeStyle = useMemo(() => {
    if (approvalStatus === "APPROVED") return styles.badgeApproved;
    if (approvalStatus === "REJECTED") return styles.badgeRejected;
    return styles.badgePending;
  }, [approvalStatus]);

  const approvalTextStyle = useMemo(() => {
    if (approvalStatus === "APPROVED") return styles.badgeApprovedText;
    if (approvalStatus === "REJECTED") return styles.badgeRejectedText;
    return styles.badgePendingText;
  }, [approvalStatus]);

  const handleLogout = () => {
    Alert.alert("Log out", "Do you want to log out of your driver account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          auth.logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.fullName?.charAt(0)?.toUpperCase() || "D"}
            </Text>
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.name}>{profile?.fullName || "Driver"}</Text>
            <Text style={styles.meta}>{profile?.email || "No email"}</Text>
            <Text style={styles.meta}>
              {profile?.vehicleType || "Vehicle not set"} •{" "}
              {profile?.plateNumber || "Plate not set"}
            </Text>
          </View>
        </View>

        <View style={styles.heroBadges}>
          <View style={[styles.badge, approvalBadgeStyle]}>
            <Text style={[styles.badgeText, approvalTextStyle]}>
              {approvalStatus}
            </Text>
          </View>

          <View style={styles.badgeNeutral}>
            <Text style={styles.badgeNeutralText}>{availability}</Text>
          </View>

          <View style={styles.badgeNeutral}>
            <Text style={styles.badgeNeutralText}>{accountStatusText}</Text>
          </View>
        </View>
      </View>

      {errorMsg ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Account Details</Text>
        <Text style={styles.infoLine}>
          Phone: {profile?.phone || "No phone"}
        </Text>
        <Text style={styles.infoLine}>
          Location: {locationLabel || "Not available"}
        </Text>
        <Text style={styles.infoLine}>
          Last location update: {formatDate(profile?.lastLocationAt)}
        </Text>
        <Text style={styles.infoLine}>
          Joined: {formatDate(profile?.createdAt)}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Vehicle & Verification</Text>
        <Text style={styles.infoLine}>
          Plate number: {profile?.plateNumber || "Not provided"}
        </Text>
        <Text style={styles.infoLine}>
          Vehicle type: {profile?.vehicleType || "Not provided"}
        </Text>
        <Text style={styles.infoLine}>
          Vehicle image:{" "}
          {profile?.vehicleImageUrl ? "Uploaded" : "Not uploaded"}
        </Text>
        <Text style={styles.infoLine}>
          Ownership proof:{" "}
          {profile?.ownershipProofUrl ? "Uploaded" : "Not uploaded"}
        </Text>
      </View>

      <SectionRow
        icon="home-outline"
        title="Driver Home"
        subtitle="Go back to your driver dashboard."
        onPress={() => router.push("/(driver)")}
      />

      <SectionRow
        icon="briefcase-outline"
        title="Available Jobs"
        subtitle="See nearby matching requests."
        onPress={() => router.push("/(driver)/jobs")}
      />

      <SectionRow
        icon="cash-outline"
        title="Earnings"
        subtitle="Review driver income and delivered jobs."
        onPress={() => router.push("/(driver)/earnings")}
      />

      <SectionRow
        icon="shield-checkmark-outline"
        title="Verification Status"
        subtitle="KYC edit flow will be connected next."
        badge={approvalStatus}
        onPress={() =>
          Alert.alert(
            "Verification",
            "Driver KYC edit flow is the next screen to wire cleanly.",
          )
        }
      />

      {profile?.suspensionReason ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Suspension Reason</Text>
          <Text style={styles.warningText}>{profile.suspensionReason}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
  },
  heroInfo: {
    flex: 1,
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  meta: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
  },
  heroBadges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  badgeApproved: {
    backgroundColor: "#dcfce7",
  },
  badgeApprovedText: {
    color: "#166534",
  },
  badgeRejected: {
    backgroundColor: "#fee2e2",
  },
  badgeRejectedText: {
    color: "#b91c1c",
  },
  badgePending: {
    backgroundColor: "#fef3c7",
  },
  badgePendingText: {
    color: "#b45309",
  },
  badgeNeutral: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeNeutralText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  errorCard: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: "#be123c",
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  cardTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },
  infoLine: {
    color: "#64748b",
    lineHeight: 21,
    marginBottom: 6,
  },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 4,
  },
  rowSubtitle: {
    color: "#64748b",
    lineHeight: 18,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowBadgeText: {
    color: "#1d4ed8",
    fontWeight: "900",
    fontSize: 11,
  },
  warningCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  warningTitle: {
    color: "#9a3412",
    fontWeight: "900",
    marginBottom: 6,
  },
  warningText: {
    color: "#9a3412",
    lineHeight: 20,
  },
  logoutButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#b91c1c",
    fontWeight: "900",
    fontSize: 15,
  },
});
