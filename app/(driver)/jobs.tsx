import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";
import {
  Trip,
  TripAcceptedPayload,
  TripExpiredPayload,
  TripStatusUpdatedPayload,
  TripUpdatedPayload,
} from "../../types/trip";

const AUTO_REFRESH_INTERVAL_MS = 8000;

type DriverJob = Trip & {
  distanceToPickupKm: number;
};

function normalizeVehicle(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getVehicleIcon(vehicle?: string | null) {
  const normalized = normalizeVehicle(vehicle);

  if (normalized.includes("tuk") || normalized.includes("rickshaw")) {
    return "rickshaw-electric";
  }

  if (normalized.includes("pickup")) {
    return "truck-pickup";
  }

  if (normalized.includes("lorry")) {
    return "truck";
  }

  if (normalized.includes("truck")) {
    return "truck-fast";
  }

  if (
    normalized.includes("bike") ||
    normalized.includes("boda") ||
    normalized.includes("motor")
  ) {
    return "motorbike";
  }

  return "truck-fast";
}

function formatVehicleLabel(vehicle?: string | null) {
  return String(vehicle || "Transport Vehicle").replace(/_/g, " ");
}

export default function DriverJobsScreen() {
  const user = useAuthStore((state) => state.user);
  const driver = user?.driverProfile;

  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingTripId, setAcceptingTripId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const canViewJobs = useMemo(() => {
    return driver?.availability === "ONLINE" || driver?.availability === "BUSY";
  }, [driver?.availability]);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiFetch("/drivers/me/nearby-trips");
      const trips: DriverJob[] = Array.isArray(data?.trips) ? data.trips : [];
      setJobs(trips);
    } catch (error: any) {
      const message =
        error?.message || "Failed to load nearby jobs for this driver.";

      if (
        typeof message === "string" &&
        (message.includes("Go online first") ||
          message.includes("location not set") ||
          message.includes("Complete driver KYC") ||
          message.includes("not approved yet") ||
          message.includes("active trip"))
      ) {
        setJobs([]);
        return;
      }

      Alert.alert("Jobs unavailable", message);
    }
  }, []);

  const fetchActiveTripAndRedirect = useCallback(async () => {
    try {
      const data = await apiFetch("/drivers/me/active-trip");
      const trip = data?.trip ?? null;

      if (trip?.id) {
        router.replace({
          pathname: "/(driver)/active-trip",
          params: { tripId: trip.id },
        });
      }
    } catch (error) {
      console.log("Failed to fetch driver active trip", error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([fetchJobs(), fetchActiveTripAndRedirect()]);
  }, [fetchJobs, fetchActiveTripAndRedirect]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll]),
  );

  useEffect(() => {
    isMountedRef.current = true;

    refreshAll().finally(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshAll]);

  useEffect(() => {
    const socket = connectSocket();

    const refreshJobs = async () => {
      await refreshAll();
    };

    const onTripAccepted = async (payload: TripAcceptedPayload) => {
      await refreshAll();

      if (payload?.tripId) {
        router.replace({
          pathname: "/(driver)/active-trip",
          params: { tripId: payload.tripId },
        });
      }
    };

    const onTripUpdated = async (payload: TripUpdatedPayload) => {
      const trip = payload?.trip;

      if (!trip) {
        await refreshJobs();
        return;
      }

      if (trip.assignedDriverId) {
        await fetchActiveTripAndRedirect();
      }

      await refreshJobs();
    };

    const onTripStatusUpdated = async (_payload: TripStatusUpdatedPayload) => {
      await refreshJobs();
    };

    const onTripExpired = async (_payload: TripExpiredPayload) => {
      await refreshJobs();
    };

    socket.on("new_trip_created", refreshJobs);
    socket.on("trip_accepted", onTripAccepted);
    socket.on("trip_updated", onTripUpdated);
    socket.on("trip_status_updated", onTripStatusUpdated);
    socket.on("trip_expired", onTripExpired);

    return () => {
      socket.off("new_trip_created", refreshJobs);
      socket.off("trip_accepted", onTripAccepted);
      socket.off("trip_updated", onTripUpdated);
      socket.off("trip_status_updated", onTripStatusUpdated);
      socket.off("trip_expired", onTripExpired);
    };
  }, [fetchActiveTripAndRedirect, refreshAll]);

  const handleAccept = useCallback(
    async (tripId: string) => {
      try {
        setAcceptingTripId(tripId);

        const data = await apiFetch(`/trips/${tripId}/accept`, {
          method: "POST",
        });

        const acceptedTrip = data?.trip;

        router.replace({
          pathname: "/(driver)/active-trip",
          params: { tripId: acceptedTrip?.id || tripId },
        });
      } catch (error: any) {
        Alert.alert("Accept failed", error?.message || "Failed to accept job.");
        await refreshAll();
      } finally {
        setAcceptingTripId(null);
      }
    },
    [refreshAll],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading live jobs...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      data={jobs}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nearby Jobs</Text>
          <Text style={styles.headerSub}>
            {driver?.availability === "ONLINE"
              ? "Fresh nearby requests matched to your vehicle and location."
              : driver?.availability === "BUSY"
                ? "You already have an active trip. New jobs are paused for now."
                : "Go online to receive matched jobs in real time."}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No jobs nearby right now</Text>
          <Text style={styles.emptyText}>
            Stay online, keep location syncing, and fresh matched jobs will land
            here automatically.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isAccepting = acceptingTripId === item.id;
        const vehicleIcon = getVehicleIcon(item.vehicleType);

        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons
                  name={vehicleIcon as any}
                  size={24}
                  color="#111827"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {formatVehicleLabel(item.vehicleType)} • {item.loadSize}
                </Text>
                <Text style={styles.subtitle}>
                  ~{Number(item.distanceToPickupKm || 0).toFixed(1)} km away
                </Text>
              </View>

              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>
                  KES {Number(item.estimatedPrice ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.value}>{item.pickupAddress}</Text>

            <Text style={styles.label}>Drop-off</Text>
            <Text style={styles.value}>{item.dropoffAddress}</Text>

            <Text style={styles.label}>Load</Text>
            <Text style={styles.value}>
              {item.loadDescription || "General goods"}
            </Text>

            <Text style={styles.label}>Trip Distance</Text>
            <Text style={styles.value}>
              {Number(item.distanceKm ?? 0).toFixed(1)} km
            </Text>

            <TouchableOpacity
              style={[
                styles.btn,
                (isAccepting || !canViewJobs) && styles.btnDisabled,
              ]}
              onPress={() => handleAccept(item.id)}
              disabled={isAccepting || !canViewJobs}
            >
              {isAccepting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Accept Job</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  header: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  headerSub: {
    color: "#6b7280",
    lineHeight: 20,
  },
  center: {
    flex: 1,
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    color: "#374151",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    lineHeight: 20,
  },
  card: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "900",
    fontSize: 16,
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4,
  },
  priceBadge: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priceBadgeText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6b7280",
    marginTop: 8,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 14,
    color: "#111827",
    marginTop: 2,
    lineHeight: 20,
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#111827",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
