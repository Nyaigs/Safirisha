import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../lib/api";

type TripStatus =
  | "SEARCHING"
  | "ACCEPTED"
  | "DRIVER_EN_ROUTE"
  | "ARRIVED_PICKUP"
  | "PICKUP_CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED_DROPOFF"
  | "DELIVERY_CONFIRMED"
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
    user?: {
      fullName?: string;
      phone?: string;
    };
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
    case "SEARCHING":
      return "Searching";
    case "ACCEPTED":
      return "Driver Accepted";
    case "DRIVER_EN_ROUTE":
      return "Driver En Route";
    case "ARRIVED_PICKUP":
      return "Arrived at Pickup";
    case "PICKUP_CONFIRMED":
      return "Pickup Confirmed";
    case "IN_TRANSIT":
      return "In Transit";
    case "ARRIVED_DROPOFF":
      return "Arrived at Drop-off";
    case "DELIVERY_CONFIRMED":
      return "Delivery Confirmed";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function getStatusColors(status: TripStatus) {
  switch (status) {
    case "DELIVERED":
      return {
        bg: "#ecfdf5",
        border: "#10b981",
        text: "#047857",
      };
    case "CANCELLED":
      return {
        bg: "#fef2f2",
        border: "#ef4444",
        text: "#dc2626",
      };
    case "SEARCHING":
      return {
        bg: "#fffbeb",
        border: "#f59e0b",
        text: "#b45309",
      };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF":
    case "DELIVERY_CONFIRMED":
      return {
        bg: "#eff6ff",
        border: "#3b82f6",
        text: "#1d4ed8",
      };
    default:
      return {
        bg: "#f3f4f6",
        border: "#9ca3af",
        text: "#374151",
      };
  }
}

function isActiveStatus(status: TripStatus) {
  return [
    "SEARCHING",
    "ACCEPTED",
    "DRIVER_EN_ROUTE",
    "ARRIVED_PICKUP",
    "PICKUP_CONFIRMED",
    "IN_TRANSIT",
    "ARRIVED_DROPOFF",
    "DELIVERY_CONFIRMED",
  ].includes(status);
}

export default function HistoryScreen() {
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const data = await apiFetch("/trips/my-trips", {
        method: "GET",
      });

      const tripList = Array.isArray(data)
        ? data
        : Array.isArray(data?.trips)
          ? data.trips
          : [];

      setTrips(
        tripList.map((trip: any) => ({
          id: String(trip.id ?? trip.requestId ?? ""),
          createdAt: String(trip.createdAt ?? ""),
          pickupAddress: String(trip.pickupAddress ?? trip.pickup ?? ""),
          dropoffAddress: String(trip.dropoffAddress ?? trip.dropoff ?? ""),
          vehicleType: String(
            trip.vehicleType ?? trip.vehicle ?? "Transport Request",
          ),
          amount: Number(trip.estimatedPrice ?? trip.amount ?? 0),
          status: String(
            trip.status ?? "SEARCHING",
          ).toUpperCase() as TripStatus,
          assignedDriver: trip.assignedDriver ?? null,
        })),
      );
    } catch (error) {
      console.error("Failed to fetch trips:", error);
      setTrips([]);
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

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips]),
  );

  const totalTrips = trips.length;

  const completedTrips = useMemo(
    () => trips.filter((item) => item.status === "DELIVERED").length,
    [trips],
  );

  const activeTrips = useMemo(
    () => trips.filter((item) => isActiveStatus(item.status)).length,
    [trips],
  );

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
      return;
    }

    router.push("/(customer)/(tabs)");
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
            <Text style={styles.title}>My Trips</Text>
            <Text style={styles.subtitle}>
              View your active and completed Safirisha transport requests
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalTrips}</Text>
            <Text style={styles.summaryLabel}>Total Trips</Text>
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
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.emptyText}>Loading your trips...</Text>
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
                  <View>
                    <Text style={styles.requestId}>{`#${trip.id.slice(0, 8).toUpperCase()}`}</Text>
                    <Text style={styles.dateText}>
                      {formatTripDate(trip.createdAt)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColors.bg,
                        borderColor: statusColors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusColors.text }]}
                    >
                      {getReadableStatus(trip.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationBlock}>
                  <View style={styles.locationRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color="#111827"
                      />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Pickup</Text>
                      <Text style={styles.locationValue}>
                        {trip.pickupAddress}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.locationRow}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="flag-outline" size={18} color="#111827" />
                    </View>
                    <View style={styles.locationTextWrap}>
                      <Text style={styles.locationLabel}>Drop-off</Text>
                      <Text style={styles.locationValue}>
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
                      color="#374151"
                    />
                    <Text style={styles.metaText}>
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

                <View style={styles.footerRow}>
                  <Text style={styles.footerHint}>
                    {active ? "Tap to view live trip" : "Trip saved in history"}
                  </Text>

                  <Ionicons
                    name={
                      active
                        ? "arrow-forward-circle-outline"
                        : "checkmark-done-circle-outline"
                    }
                    size={18}
                    color={active ? "#1d4ed8" : "#047857"}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace("/(customer)/(tabs)")}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
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
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#e5e7eb",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
  },
  requestId: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  dateText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  locationBlock: {
    marginBottom: 14,
    gap: 10,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  amountText: {
    color: "#047857",
  },
  footerRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerHint: {
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 13,
  },
  homeButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
