import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Trip } from "../../types/trip";
import {
  haversineKm,
  isValidCoordinate,
  toNumber,
} from "../../utils/validators";

const MAX_DISTANCE_KM = 20;

type DriverProfileLite = {
  id?: string;
  availability?: "OFFLINE" | "ONLINE" | "BUSY";
  vehicleType?: string | null;
  plateNumber?: string | null;
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
  vehicleImageUrl?: string | null;
  ownershipProofUrl?: string | null;
  approvalStatus?: string | null;
};

type TripWithDistance = Trip & {
  distanceToPickupKm: number;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedPrice: number;
  loadDescription: string;
  loadSize: string;
  vehicleType: string;
  distanceKm: number;
};

function normalizeVehicleType(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function sortJobsByDistance(list: TripWithDistance[]) {
  return [...list].sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
}

export default function DriverJobsScreen() {
  const user = useAuthStore((state) => state.user);

  const driverProfile = (user?.driverProfile ??
    null) as DriverProfileLite | null;
  const availability = driverProfile?.availability ?? "OFFLINE";

  const [jobs, setJobs] = useState<TripWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingTripId, setAcceptingTripId] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  const driverStateRef = useRef({
    lat: driverProfile?.currentLat ?? null,
    lng: driverProfile?.currentLng ?? null,
    vehicleType: driverProfile?.vehicleType ?? null,
    availability,
  });

  useEffect(() => {
    driverStateRef.current = {
      lat: driverProfile?.currentLat ?? null,
      lng: driverProfile?.currentLng ?? null,
      vehicleType: driverProfile?.vehicleType ?? null,
      availability,
    };
  }, [
    driverProfile?.currentLat,
    driverProfile?.currentLng,
    driverProfile?.vehicleType,
    availability,
  ]);

  const updateAuthDriverProfile = useCallback(
    (driver: DriverProfileLite | null) => {
      if (!driver) return;

      const state = useAuthStore.getState();
      const authUser = state.user;

      if (!authUser) return;

      state.setUser({
        ...authUser,
        driverProfile: {
          ...(authUser.driverProfile || {}),
          id: driver.id ?? authUser.driverProfile?.id ?? "",
          plateNumber:
            driver.plateNumber ?? authUser.driverProfile?.plateNumber ?? "",
          vehicleType:
            driver.vehicleType ?? authUser.driverProfile?.vehicleType ?? "",
          availability:
            driver.availability ?? authUser.driverProfile?.availability,
          currentLat: driver.currentLat ?? null,
          currentLng: driver.currentLng ?? null,
          currentHeading: driver.currentHeading ?? null,
          currentSpeed: driver.currentSpeed ?? null,
          lastLocationAt: driver.lastLocationAt ?? null,
          vehicleImageUrl: authUser.driverProfile?.vehicleImageUrl,
          ownershipProofUrl: authUser.driverProfile?.ownershipProofUrl,
          approvalStatus: authUser.driverProfile?.approvalStatus,
        },
      });
    },
    [],
  );

  const fetchFreshDriverProfile = useCallback(async () => {
    try {
      const data = await apiFetch("/drivers/me");
      const driver = (data?.driver ?? null) as DriverProfileLite | null;

      updateAuthDriverProfile(driver);

      return driver;
    } catch (error) {
      console.log("Failed to refresh driver profile", error);
      return null;
    }
  }, [updateAuthDriverProfile]);

  const mapTrip = useCallback(
    (
      trip: Trip,
      lat: number,
      lng: number,
      fallbackVehicleType?: string | null,
    ): TripWithDistance => {
      const rawPickupLat = toNumber((trip as any).pickupLat, NaN);
      const rawPickupLng = toNumber((trip as any).pickupLng, NaN);

      const distanceToPickupKm =
        Number.isFinite(rawPickupLat) && Number.isFinite(rawPickupLng)
          ? haversineKm(lat, lng, rawPickupLat, rawPickupLng)
          : Number.MAX_SAFE_INTEGER;

      return {
        ...trip,
        pickupAddress:
          (trip as any).pickupAddress ??
          (trip as any).pickupLocation ??
          "Pickup not provided",
        dropoffAddress:
          (trip as any).dropoffAddress ??
          (trip as any).dropoffLocation ??
          "Drop-off not provided",
        estimatedPrice: toNumber((trip as any).estimatedPrice, 0),
        loadDescription: (trip as any).loadDescription ?? "General goods",
        loadSize: (trip as any).loadSize ?? "Not set",
        vehicleType:
          (trip as any).vehicleType ??
          fallbackVehicleType ??
          "Transport Request",
        distanceKm: toNumber((trip as any).distanceKm, 0),
        distanceToPickupKm,
      };
    },
    [],
  );

  const fetchJobs = useCallback(async () => {
    try {
      let lat = driverStateRef.current.lat;
      let lng = driverStateRef.current.lng;
      let vehicleType = driverStateRef.current.vehicleType;

      if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
        const freshDriver = await fetchFreshDriverProfile();
        lat = freshDriver?.currentLat ?? null;
        lng = freshDriver?.currentLng ?? null;
        vehicleType = freshDriver?.vehicleType ?? vehicleType ?? null;
      }

      const hasLocation = isValidCoordinate(lat) && isValidCoordinate(lng);
      setLocationReady(hasLocation);

      if (!hasLocation) {
        setJobs([]);
        return;
      }

      const data = await apiFetch("/drivers/me/nearby-trips");
      const trips: Trip[] = Array.isArray(data?.trips) ? data.trips : [];

      const normalizedDriverVehicle = normalizeVehicleType(vehicleType);

      const nearbyJobs = trips
        .map((trip) => mapTrip(trip, lat as number, lng as number, vehicleType))
        .filter((trip) => trip.distanceToPickupKm <= MAX_DISTANCE_KM)
        .filter((trip) => {
          const normalizedTripVehicle = normalizeVehicleType(trip.vehicleType);

          if (!normalizedDriverVehicle || !normalizedTripVehicle) {
            return true;
          }

          return normalizedTripVehicle === normalizedDriverVehicle;
        });

      setJobs(sortJobsByDistance(nearbyJobs));
    } catch (error: any) {
      console.log("Failed to load jobs", error);
      setJobs([]);
      Alert.alert(
        "Failed to load jobs",
        error?.message || "Something went wrong while loading nearby jobs.",
      );
    }
  }, [fetchFreshDriverProfile, mapTrip]);

  useEffect(() => {
    let isMounted = true;

    fetchJobs().finally(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchJobs]);

  useEffect(() => {
    const socket = connectSocket();

    const onNewTripCreated = (trip: Trip) => {
      const { lat, lng, vehicleType } = driverStateRef.current;

      if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
        return;
      }

      const incomingVehicleType = (trip as any).vehicleType ?? null;

      if (
        vehicleType &&
        incomingVehicleType &&
        normalizeVehicleType(incomingVehicleType) !==
          normalizeVehicleType(vehicleType)
      ) {
        return;
      }

      const normalizedTrip = mapTrip(
        trip,
        lat as number,
        lng as number,
        vehicleType,
      );

      if (normalizedTrip.distanceToPickupKm > MAX_DISTANCE_KM) {
        return;
      }

      setJobs((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.id === normalizedTrip.id,
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = normalizedTrip;
          return sortJobsByDistance(updated);
        }

        return sortJobsByDistance([normalizedTrip, ...prev]);
      });
    };

    const onTripAccepted = (payload: { tripId?: string }) => {
      if (!payload?.tripId) return;
      setJobs((prev) => prev.filter((job) => job.id !== payload.tripId));
    };

    socket.on("new_trip_created", onNewTripCreated);
    socket.on("trip_accepted", onTripAccepted);

    return () => {
      socket.off("new_trip_created", onNewTripCreated);
      socket.off("trip_accepted", onTripAccepted);
    };
  }, [mapTrip]);

  const handleAccept = async (tripId: string) => {
    if (availability === "BUSY") {
      Alert.alert(
        "Active trip in progress",
        "Finish your current trip before accepting another job.",
      );
      return;
    }

    if (availability !== "ONLINE") {
      Alert.alert(
        "Go online first",
        "You need to be online before accepting a job.",
      );
      return;
    }

    try {
      setAcceptingTripId(tripId);

      const data = await apiFetch(`/trips/${tripId}/accept`, {
        method: "POST",
      });

      const acceptedTripId = data?.trip?.id ?? tripId;

      setJobs((prev) => prev.filter((job) => job.id !== tripId));
      await fetchJobs();

      router.replace({
        pathname: "/(driver)/active-trip",
        params: { tripId: acceptedTripId },
      });
    } catch (error: any) {
      console.log("Accept failed", error);
      Alert.alert(
        "Accept failed",
        error?.message || "Could not accept this trip.",
      );
    } finally {
      setAcceptingTripId(null);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchJobs();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading nearby jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Jobs</Text>
      <Text style={styles.subtitle}>
        Jobs close to your current location and vehicle type.
      </Text>

      <View
        style={[
          styles.availabilityPill,
          availability === "ONLINE"
            ? styles.availabilityOnline
            : availability === "BUSY"
              ? styles.availabilityBusy
              : styles.availabilityOffline,
        ]}
      >
        <Text
          style={[
            styles.availabilityText,
            availability === "ONLINE"
              ? styles.availabilityTextOnline
              : availability === "BUSY"
                ? styles.availabilityTextBusy
                : styles.availabilityTextOffline,
          ]}
        >
          Driver Status: {availability}
        </Text>
      </View>

      {!locationReady ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Location needed</Text>
          <Text style={styles.noticeText}>
            Your current driver location is not available yet. Go to the driver
            dashboard, sync location, then reopen jobs.
          </Text>
        </View>
      ) : null}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No nearby jobs right now</Text>
            <Text style={styles.emptyText}>
              Stay online and refresh again. New requests will land here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const accepting = acceptingTripId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>
                  {item.vehicleType} • {item.loadSize}
                </Text>

                <View style={styles.distancePill}>
                  <Text style={styles.distancePillText}>
                    {item.distanceToPickupKm.toFixed(1)} km
                  </Text>
                </View>
              </View>

              <View style={styles.block}>
                <Text style={styles.label}>Pickup</Text>
                <Text style={styles.value}>{item.pickupAddress}</Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.label}>Drop-off</Text>
                <Text style={styles.value}>{item.dropoffAddress}</Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.label}>Load</Text>
                <Text style={styles.value}>{item.loadDescription}</Text>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Price</Text>
                  <Text style={styles.metaValue}>
                    KES {Number(item.estimatedPrice ?? 0).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Trip Distance</Text>
                  <Text style={styles.metaValue}>{item.distanceKm} km</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  accepting ? styles.acceptBtnDisabled : null,
                ]}
                onPress={() => handleAccept(item.id)}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept Job</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    paddingTop: 56,
  },
  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: "#374151",
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    color: "#6b7280",
    marginBottom: 14,
  },
  availabilityPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  availabilityOnline: {
    backgroundColor: "#dcfce7",
  },
  availabilityBusy: {
    backgroundColor: "#dbeafe",
  },
  availabilityOffline: {
    backgroundColor: "#fee2e2",
  },
  availabilityText: {
    fontWeight: "700",
  },
  availabilityTextOnline: {
    color: "#166534",
  },
  availabilityTextBusy: {
    color: "#1d4ed8",
  },
  availabilityTextOffline: {
    color: "#991b1b",
  },
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 6,
  },
  noticeText: {
    color: "#7c2d12",
    lineHeight: 20,
  },
  emptyWrap: {
    paddingVertical: 42,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    marginRight: 12,
  },
  distancePill: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distancePillText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  block: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  metaItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  metaLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
  },
  acceptBtn: {
    marginTop: 16,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  acceptBtnDisabled: {
    opacity: 0.7,
  },
  acceptBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
