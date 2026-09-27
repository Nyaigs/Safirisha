import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
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

type TripStatus =
  | "SEARCHING"
  | "SEARCHING_DRIVER"
  | "ACCEPTED"
  | "DRIVER_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVED"
  | "ARRIVED_PICKUP"
  | "PICKUP_CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED_DROPOFF"
  | "DELIVERY_CONFIRMED"
  | "PAYMENT_PENDING"
  | "DELIVERED"
  | "CANCELLED";

type TripItem = {
  id: string;
  createdAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleType: string;
  amount: number;
  status: TripStatus;
  assignedDriver?: {
    user?: { fullName?: string; phone?: string };
    plateNumber?: string;
  } | null;
};

function formatTripDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

function formatMoney(amount: number) {
  return `KES ${Number(amount ?? 0).toLocaleString()}`;
}

function getReadableStatus(status: TripStatus) {
  switch (status) {
    case "SEARCHING": return "Searching";
    case "SEARCHING_DRIVER": return "Finding a Driver";
    case "ACCEPTED": return "Driver Accepted";
    case "DRIVER_ASSIGNED": return "Driver Assigned";
    case "DRIVER_EN_ROUTE": return "Driver En Route";
    case "DRIVER_ARRIVED": return "Driver Arrived";
    case "ARRIVED_PICKUP": return "Arrived at Pickup";
    case "PICKUP_CONFIRMED": return "Pickup Confirmed";
    case "IN_TRANSIT": return "In Transit";
    case "ARRIVED_DROPOFF": return "Arrived at Drop-off";
    case "DELIVERY_CONFIRMED": return "Delivery Confirmed";
    case "PAYMENT_PENDING": return "Payment Pending";
    case "DELIVERED": return "Delivered";
    case "CANCELLED": return "Cancelled";
    default: return "Unknown";
  }
}

function getStatusColors(status: TripStatus) {
  switch (status) {
    case "DELIVERED": return { bg: "#ecfdf5", border: "#10b981", text: "#047857" };
    case "CANCELLED": return { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" };
    case "SEARCHING":
    case "SEARCHING_DRIVER": return { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" };
    default: return { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" };
  }
}

function isActiveStatus(status: TripStatus) {
  return [
    "SEARCHING", "SEARCHING_DRIVER", "ACCEPTED", "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "ARRIVED_PICKUP", "PICKUP_CONFIRMED",
    "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING",
  ].includes(status);
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/trips/my-trips", { method: "GET" });
      const tripList = Array.isArray(data) ? data : Array.isArray(data?.trips) ? data.trips : [];
      setTrips(
        tripList.map((trip: any) => ({
          id: String(trip.id ?? trip.requestId ?? ""),
          createdAt: String(trip.createdAt ?? ""),
          pickupAddress: String(trip.pickupAddress ?? trip.pickup ?? ""),
          dropoffAddress: String(trip.dropoffAddress ?? trip.dropoff ?? ""),
          vehicleType: String(trip.vehicleType ?? trip.vehicle ?? "Transport Request"),
          amount: Number(trip.estimatedPrice ?? trip.amount ?? 0),
          status: String(trip.status ?? "SEARCHING").toUpperCase() as TripStatus,
          assignedDriver: trip.assignedDriver ?? null,
        })),
      );
    } catch (cause) {
      console.error("Failed to fetch trips:", cause);
      setError("We couldn't load your trips. Check your connection and try again.");
    }
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      await fetchTrips();
    } finally {
      setLoading(false);
    }
  }, [fetchTrips]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchTrips();
    } finally {
      setRefreshing(false);
    }
  }, [fetchTrips]);

  useFocusEffect(useCallback(() => { loadTrips(); }, [loadTrips]));

  const totalTrips = trips.length;
  const completedTrips = useMemo(() => trips.filter((i) => i.status === "DELIVERED").length, [trips]);
  const activeTrips = useMemo(() => trips.filter((i) => isActiveStatus(i.status)).length, [trips]);

  const handleTripPress = (trip: TripItem) => {
    if (isActiveStatus(trip.status)) {
      router.push({
        pathname: "/(customer)/live-trip",
        params: {
          tripId: trip.id,
          driverName: trip.assignedDriver?.user?.fullName || "",
          driverPhone: trip.assignedDriver?.user?.phone || "",
          plateNumber: trip.assignedDriver?.plateNumber || "",
        },
      });
    }
  };

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
            <Text style={styles.title}>My Trips</Text>
            <Text style={styles.subtitle}>Active and completed transport requests</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalTrips}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completedTrips}</Text>
            <Text style={styles.summaryLabel}>Delivered</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{activeTrips}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Trips unavailable</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTrips}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>
              Once you request transport, your trip history will appear here.
            </Text>
          </View>
        ) : (
          trips.map((trip) => {
            const statusColors = getStatusColors(trip.status);
            const active = isActiveStatus(trip.status);

            return (
              <TouchableOpacity
                key={trip.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => handleTripPress(trip)}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestId}>
                      {`#${trip.id.slice(0, 8).toUpperCase()}`}
                    </Text>
                    <Text style={styles.dateText}>{formatTripDate(trip.createdAt)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColors.bg, borderColor: statusColors.border },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {getReadableStatus(trip.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationBlock}>
                  <View style={styles.locationRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="location-outline" size={18} color={design.colors.ink} />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Pickup</Text>
                      <Text style={styles.locationValue} numberOfLines={2}>
                        {trip.pickupAddress}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="flag-outline" size={18} color={design.colors.ink} />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Drop-off</Text>
                      <Text style={styles.locationValue} numberOfLines={2}>
                        {trip.dropoffAddress}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name="truck-fast-outline"
                      size={18}
                      color={design.colors.muted}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {trip.vehicleType.replace(/_/g, " ")}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name="cash-multiple"
                      size={18}
                      color="#047857"
                    />
                    <Text style={[styles.metaText, styles.amountText]}>
                      {formatMoney(trip.amount)}
                    </Text>
                  </View>
                </View>

                {active ? (
                  <View style={styles.footerRow}>
                    <Text style={styles.footerHint}>Tap to view live trip</Text>
                    <Ionicons name="arrow-forward-circle-outline" size={18} color="#1d4ed8" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
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
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: design.colors.subtle,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: design.radius.lg,
    paddingVertical: design.spacing.md,
    paddingHorizontal: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 36, backgroundColor: "#e5e7eb" },
  summaryValue: { fontSize: 22, fontWeight: "800", color: design.colors.ink },
  summaryLabel: { fontSize: 13, color: design.colors.muted, marginTop: design.spacing.xs },
  emptyWrap: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: design.colors.ink,
    marginBottom: design.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: design.colors.muted,
    textAlign: "center",
    marginTop: design.spacing.sm,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: design.spacing.md,
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.md,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
  },
  retryButtonText: { color: design.colors.white, fontWeight: "800" },
  card: {
    backgroundColor: design.colors.subtle,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    marginBottom: design.spacing.md,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: design.spacing.md,
    gap: design.spacing.sm,
  },
  requestId: { fontSize: 17, fontWeight: "800", color: design.colors.ink },
  dateText: { fontSize: 13, color: design.colors.muted, marginTop: design.spacing.xs },
  statusBadge: {
    borderWidth: 1,
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
  },
  statusText: { fontSize: 12, fontWeight: "800" },
  locationBlock: { marginBottom: design.spacing.md, gap: design.spacing.sm },
  locationRow: { flexDirection: "row", alignItems: "center" },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: design.spacing.sm,
  },
  locationTextWrap: { flex: 1 },
  locationLabel: { fontSize: 12, color: design.colors.muted, marginBottom: 2 },
  locationValue: { fontSize: 15, fontWeight: "600", color: design.colors.ink, lineHeight: 20 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: design.spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: design.spacing.xs },
  metaText: { fontSize: 14, fontWeight: "600", color: design.colors.muted },
  amountText: { color: "#047857" },
  footerRow: {
    marginTop: design.spacing.md,
    paddingTop: design.spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerHint: { color: design.colors.muted, fontWeight: "700", fontSize: 13 },
});