import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";

type RequestStatus =
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

type AdminTrip = {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  vehicleType?: string;
  loadDescription?: string;
  loadSize?: string;
  estimatedPrice?: number;
  status: RequestStatus;
  customer?: {
    fullName?: string;
    phone?: string;
  };
  assignedDriver?: {
    user?: {
      fullName?: string;
      phone?: string;
    };
    vehicleType?: string;
  } | null;
  createdAt?: string;
};

type TripFilter = "ALL" | "SEARCHING" | "ACTIVE" | "DELIVERED" | "CANCELLED";

function getStatusColors(status: RequestStatus) {
  switch (status) {
    case "DELIVERED":
      return {
        bg: "#DCFCE7",
        text: "#166534",
        border: "#86EFAC",
        soft: "#F0FDF4",
      };
    case "CANCELLED":
      return {
        bg: "#FEE2E2",
        text: "#B91C1C",
        border: "#FCA5A5",
        soft: "#FEF2F2",
      };
    case "SEARCHING":
      return {
        bg: "#FEF3C7",
        text: "#B45309",
        border: "#FCD34D",
        soft: "#FFFBEB",
      };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF":
    case "DELIVERY_CONFIRMED":
      return {
        bg: "#E0E7FF",
        text: "#4338CA",
        border: "#A5B4FC",
        soft: "#EEF2FF",
      };
    default:
      return {
        bg: "#E2E8F0",
        text: "#0F172A",
        border: "#CBD5E1",
        soft: "#F8FAFC",
      };
  }
}

function getReadableStatus(status: RequestStatus) {
  return status.replaceAll("_", " ");
}

function isActiveTrip(status: RequestStatus) {
  return [
    "ACCEPTED",
    "DRIVER_EN_ROUTE",
    "ARRIVED_PICKUP",
    "PICKUP_CONFIRMED",
    "IN_TRANSIT",
    "ARRIVED_DROPOFF",
    "DELIVERY_CONFIRMED",
  ].includes(status);
}

function formatMoney(value?: number) {
  return `KES ${Number(value ?? 0).toLocaleString()}`;
}

function formatVehicleType(value?: string) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

function formatDate(value?: string) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTripStageText(status: RequestStatus) {
  switch (status) {
    case "SEARCHING":
      return "Waiting for driver assignment";
    case "ACCEPTED":
      return "Driver assigned";
    case "DRIVER_EN_ROUTE":
      return "Driver heading to pickup";
    case "ARRIVED_PICKUP":
      return "Driver reached pickup";
    case "PICKUP_CONFIRMED":
      return "Pickup confirmed";
    case "IN_TRANSIT":
      return "Trip in progress";
    case "ARRIVED_DROPOFF":
      return "Driver reached drop-off";
    case "DELIVERY_CONFIRMED":
      return "Delivery confirmed";
    case "DELIVERED":
      return "Trip completed";
    case "CANCELLED":
      return "Trip cancelled";
    default:
      return "Unknown stage";
  }
}

export default function AdminTripsScreen() {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TripFilter>("ALL");

  const fetchTrips = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/trips");
      setTrips(
        Array.isArray(res?.trips) ? res.trips : Array.isArray(res) ? res : [],
      );
    } catch (error) {
      console.log("Trips fetch failed:", error);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const searchedTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;

    return trips.filter((trip) => {
      const haystack = [
        trip.pickupAddress ?? "",
        trip.dropoffAddress ?? "",
        trip.vehicleType ?? "",
        trip.loadDescription ?? "",
        trip.loadSize ?? "",
        trip.status ?? "",
        trip.customer?.fullName ?? "",
        trip.customer?.phone ?? "",
        trip.assignedDriver?.user?.fullName ?? "",
        trip.assignedDriver?.user?.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [search, trips]);

  const filteredTrips = useMemo(() => {
    switch (filter) {
      case "SEARCHING":
        return searchedTrips.filter((trip) => trip.status === "SEARCHING");
      case "ACTIVE":
        return searchedTrips.filter((trip) => isActiveTrip(trip.status));
      case "DELIVERED":
        return searchedTrips.filter((trip) => trip.status === "DELIVERED");
      case "CANCELLED":
        return searchedTrips.filter((trip) => trip.status === "CANCELLED");
      case "ALL":
      default:
        return searchedTrips;
    }
  }, [searchedTrips, filter]);

  const totalTrips = trips.length;
  const activeTrips = useMemo(
    () => trips.filter((trip) => isActiveTrip(trip.status)).length,
    [trips],
  );
  const deliveredTrips = useMemo(
    () => trips.filter((trip) => trip.status === "DELIVERED").length,
    [trips],
  );
  const searchingTrips = useMemo(
    () => trips.filter((trip) => trip.status === "SEARCHING").length,
    [trips],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={24}
              color="#fff"
            />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Trips Overview</Text>
            <Text style={styles.headerSubtitle}>
              Monitor live, searching, completed, and cancelled trips.
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            placeholder="Search pickup, drop-off, customer, driver..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />
          {search.trim() ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Total" value={totalTrips} icon="grid-outline" />
        <StatCard
          label="Searching"
          value={searchingTrips}
          icon="time-outline"
        />
        <StatCard label="Active" value={activeTrips} icon="pulse-outline" />
        <StatCard
          label="Delivered"
          value={deliveredTrips}
          icon="checkmark-done-outline"
        />
      </View>

      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "ALL"}
          onPress={() => setFilter("ALL")}
        />
        <FilterChip
          label="Searching"
          active={filter === "SEARCHING"}
          onPress={() => setFilter("SEARCHING")}
        />
        <FilterChip
          label="Active"
          active={filter === "ACTIVE"}
          onPress={() => setFilter("ACTIVE")}
        />
        <FilterChip
          label="Delivered"
          active={filter === "DELIVERED"}
          onPress={() => setFilter("DELIVERED")}
        />
        <FilterChip
          label="Cancelled"
          active={filter === "CANCELLED"}
          onPress={() => setFilter("CANCELLED")}
        />
      </View>

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTrips();
            }}
          />
        }
        contentContainerStyle={
          filteredTrips.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        renderItem={({ item }) => {
          const statusColors = getStatusColors(item.status);

          return (
            <TouchableOpacity
              style={[styles.tripCard, { backgroundColor: statusColors.soft }]}
              activeOpacity={0.92}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/trip-details",
                  params: { tripId: item.id },
                })
              }
            >
              <View style={styles.tripTop}>
                <View style={styles.tripTitleWrap}>
                  <Text style={styles.tripTitle} numberOfLines={2}>
                    {item.pickupAddress || "Unknown pickup"} →{" "}
                    {item.dropoffAddress || "Unknown drop-off"}
                  </Text>
                  <Text style={styles.tripStageText}>
                    {getTripStageText(item.status)}
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
                    style={[
                      styles.statusBadgeText,
                      { color: statusColors.text },
                    ]}
                  >
                    {getReadableStatus(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <MiniInfo
                  label="Vehicle"
                  value={formatVehicleType(item.vehicleType)}
                />
                <MiniInfo label="Load Size" value={item.loadSize || "—"} />
                <MiniInfo
                  label="Price"
                  value={formatMoney(item.estimatedPrice)}
                />
                <MiniInfo label="Created" value={formatDate(item.createdAt)} />
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Description:</Text>{" "}
                  {item.loadDescription || "—"}
                </Text>

                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Customer:</Text>{" "}
                  {item.customer?.fullName || "—"}
                  {item.customer?.phone ? ` • ${item.customer.phone}` : ""}
                </Text>

                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Driver:</Text>{" "}
                  {item.assignedDriver?.user?.fullName || "Not assigned"}
                  {item.assignedDriver?.user?.phone
                    ? ` • ${item.assignedDriver.user.phone}`
                    : ""}
                </Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerHint}>Tap to view trip details</Text>
                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={20}
                  color="#0f172a"
                />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="file-tray-outline"
              size={28}
              color="#94a3b8"
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No trips found</Text>
            <Text style={styles.emptyText}>
              Try changing the search or filter to see more results.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={16} color="#0f172a" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniInfoCard}>
      <Text style={styles.miniInfoLabel}>{label}</Text>
      <Text style={styles.miniInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  loadingText: {
    marginTop: 10,
    color: "#475569",
    fontWeight: "600",
  },

  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  headerSubtitle: {
    color: "#64748b",
    marginTop: 4,
    lineHeight: 19,
    fontSize: 13,
  },

  searchWrap: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 8,
    color: "#0f172a",
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  filterChipText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: "#fff",
  },

  listContent: {
    paddingBottom: 24,
  },
  tripCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tripTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  tripTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 22,
  },
  tripStageText: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  miniInfoCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 10,
  },
  miniInfoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  miniInfoValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },

  infoSection: {
    marginTop: 2,
  },
  meta: {
    color: "#475569",
    marginTop: 6,
    lineHeight: 20,
    fontSize: 14,
  },
  metaLabel: {
    color: "#111827",
    fontWeight: "800",
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
    color: "#64748b",
    fontWeight: "700",
    fontSize: 13,
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 32,
  },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    lineHeight: 20,
  },
});
