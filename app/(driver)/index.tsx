import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
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
import OnlineToggle from "../../components/onlinetoggle";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";
import { Trip } from "../../types/trip";
import {
  haversineKm,
  isValidCoordinate,
  toNumber,
} from "../../utils/validators";

const MAX_DISTANCE_KM = 10;

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
  createdAt?: string;
  updatedAt?: string;
};

type TripWithDistance = Trip & {
  distanceToPickupKm: number;
};

type ActiveTripLite = {
  id: string;
  status: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  customerName?: string;
};

function buildInitialDriverProfile(): DriverProfileResponse | null {
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

function statusTone(status?: string) {
  switch (status) {
    case "APPROVED":
      return {
        bg: "#dcfce7",
        text: "#166534",
      };
    case "REJECTED":
      return {
        bg: "#fee2e2",
        text: "#b91c1c",
      };
    default:
      return {
        bg: "#fef3c7",
        text: "#b45309",
      };
  }
}

function formatTripStatus(status?: string) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ");
}

export default function DriverHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [syncingLocation, setSyncingLocation] = useState(false);
  const [driverProfile, setDriverProfile] =
    useState<DriverProfileResponse | null>(buildInitialDriverProfile);
  const [nearbyTrips, setNearbyTrips] = useState<TripWithDistance[]>([]);
  const [locationLabel, setLocationLabel] = useState("Location not synced yet");
  const [activeTrip, setActiveTrip] = useState<ActiveTripLite | null>(null);

  const isApproved = useMemo(
    () => driverProfile?.approvalStatus === "APPROVED",
    [driverProfile?.approvalStatus],
  );

  const isOnline = useMemo(
    () => driverProfile?.availability === "ONLINE",
    [driverProfile?.availability],
  );

  const badgeTone = useMemo(
    () => statusTone(driverProfile?.approvalStatus),
    [driverProfile?.approvalStatus],
  );

  const fetchDriverProfile = useCallback(async () => {
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    setDriverProfile(normalized);
    syncDriverIntoStore(normalized);

    if (
      isValidCoordinate(normalized.currentLat) &&
      isValidCoordinate(normalized.currentLng)
    ) {
      const name = await reverseLocationName(
        normalized.currentLat,
        normalized.currentLng,
      );
      setLocationLabel(name);
    } else {
      setLocationLabel("Location not synced yet");
    }

    return normalized;
  }, []);

  const fetchActiveTrip = useCallback(async () => {
    try {
      const res = await apiFetch("/trips/my-active-driver");
      const trip = res?.trip;

      if (!trip) {
        setActiveTrip(null);
        return;
      }

      setActiveTrip({
        id: trip.id,
        status: trip.status,
        pickupAddress: trip.pickupAddress,
        dropoffAddress: trip.dropoffAddress,
        customerName: trip.customer?.fullName || "Customer",
      });
    } catch (error) {
      console.log("Failed to fetch active trip", error);
      setActiveTrip(null);
    }
  }, []);

  const fetchNearbyTrips = useCallback(
    async (lat?: number, lng?: number) => {
      try {
        const data = await apiFetch("/drivers/me/nearby-trips");

        const driverLat = lat ?? driverProfile?.currentLat ?? null;
        const driverLng = lng ?? driverProfile?.currentLng ?? null;

        if (!isValidCoordinate(driverLat) || !isValidCoordinate(driverLng)) {
          setNearbyTrips([]);
          return;
        }

        const trips: Trip[] = Array.isArray(data?.trips) ? data.trips : [];

        const nearby: TripWithDistance[] = trips
          .map((trip: Trip) => {
            const pickupLat = toNumber((trip as any).pickupLat, NaN);
            const pickupLng = toNumber((trip as any).pickupLng, NaN);

            const distanceToPickupKm =
              Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
                ? haversineKm(driverLat, driverLng, pickupLat, pickupLng)
                : Number.MAX_SAFE_INTEGER;

            return {
              ...trip,
              distanceToPickupKm,
            };
          })
          .filter((trip) => trip.distanceToPickupKm <= MAX_DISTANCE_KM)
          .sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);

        setNearbyTrips(nearby);
      } catch (error) {
        console.log("Failed to fetch nearby trips", error);
        setNearbyTrips([]);
      }
    },
    [driverProfile?.currentLat, driverProfile?.currentLng],
  );

  const syncCurrentLocation = useCallback(async () => {
    setSyncingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        throw new Error("Location permission denied");
      }

      const freshLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const finalLat = freshLoc.coords.latitude;
      const finalLng = freshLoc.coords.longitude;

      const response = await apiFetch("/drivers/me/location", {
        method: "PATCH",
        body: {
          lat: finalLat,
          lng: finalLng,
          heading: freshLoc.coords.heading ?? undefined,
          speed: freshLoc.coords.speed ?? undefined,
        },
      });

      const updatedProfile: DriverProfileResponse = {
        ...(driverProfile ?? {}),
        ...(response?.driver ?? {}),
        currentLat: response?.driver?.currentLat ?? finalLat,
        currentLng: response?.driver?.currentLng ?? finalLng,
        currentHeading:
          response?.driver?.currentHeading ?? freshLoc.coords.heading ?? null,
        currentSpeed:
          response?.driver?.currentSpeed ?? freshLoc.coords.speed ?? null,
        lastLocationAt:
          response?.driver?.lastLocationAt ?? new Date().toISOString(),
      };

      setDriverProfile(updatedProfile);
      syncDriverIntoStore(updatedProfile);

      const readableLocation = await reverseLocationName(finalLat, finalLng);
      setLocationLabel(readableLocation);

      if (updatedProfile.availability === "ONLINE") {
        await fetchNearbyTrips(finalLat, finalLng);
      }

      return { lat: finalLat, lng: finalLng };
    } catch (error: any) {
      Alert.alert(
        "Location sync failed",
        error?.message || "Could not sync your location.",
      );
      return null;
    } finally {
      setSyncingLocation(false);
    }
  }, [driverProfile, fetchNearbyTrips]);

  const handleToggleOnline = useCallback(async () => {
    if (!driverProfile?.id) {
      Alert.alert("Missing profile", "Driver profile is not available.");
      return;
    }

    if (!isApproved) {
      Alert.alert(
        "Approval pending",
        "Your account must be approved before you can go online.",
      );
      return;
    }

    if (activeTrip && driverProfile.availability === "BUSY") {
      Alert.alert(
        "Active trip in progress",
        "Finish your current trip before changing availability.",
      );
      return;
    }

    try {
      setLoadingToggle(true);

      const nextAvailability: DriverAvailability = isOnline
        ? "OFFLINE"
        : "ONLINE";

      if (nextAvailability === "ONLINE") {
        const synced = await syncCurrentLocation();
        if (!synced) return;
      }

      const res = await apiFetch("/drivers/me/availability", {
        method: "PATCH",
        body: {
          availability: nextAvailability,
        },
      });

      const updatedDriver = {
        ...(driverProfile ?? {}),
        ...(res?.driver ?? {}),
        availability: (res?.driver?.availability ??
          nextAvailability) as DriverAvailability,
      };

      setDriverProfile(updatedDriver);
      syncDriverIntoStore(updatedDriver);

      if (nextAvailability === "ONLINE") {
        await fetchNearbyTrips(
          updatedDriver.currentLat ?? undefined,
          updatedDriver.currentLng ?? undefined,
        );
      } else {
        setNearbyTrips([]);
      }
    } catch (error: any) {
      Alert.alert(
        "Availability update failed",
        error?.message || "Could not update your availability.",
      );
    } finally {
      setLoadingToggle(false);
    }
  }, [
    activeTrip,
    driverProfile,
    fetchNearbyTrips,
    isApproved,
    isOnline,
    syncCurrentLocation,
  ]);

  const loadDashboard = useCallback(async () => {
    try {
      const profile = await fetchDriverProfile();
      await fetchActiveTrip();

      if (
        profile.approvalStatus === "APPROVED" &&
        profile.availability === "ONLINE"
      ) {
        await fetchNearbyTrips(
          profile.currentLat ?? undefined,
          profile.currentLng ?? undefined,
        );
      } else {
        setNearbyTrips([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchActiveTrip, fetchDriverProfile, fetchNearbyTrips]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard();
    }, [loadDashboard]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const socket = connectSocket();

    const refreshAll = () => {
      fetchActiveTrip();
      fetchDriverProfile().catch(() => {});
      if (driverProfile?.availability === "ONLINE") {
        fetchNearbyTrips().catch(() => {});
      }
    };

    socket.on("trip_status_updated", refreshAll);
    socket.on("admin_stats_updated", refreshAll);
    socket.on("new_trip_created", refreshAll);

    return () => {
      socket.off("trip_status_updated", refreshAll);
      socket.off("admin_stats_updated", refreshAll);
      socket.off("new_trip_created", refreshAll);
    };
  }, [
    driverProfile?.availability,
    fetchActiveTrip,
    fetchDriverProfile,
    fetchNearbyTrips,
  ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Loading driver dashboard...</Text>
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
              {driverProfile?.fullName?.charAt(0)?.toUpperCase() || "D"}
            </Text>
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.name}>
              {driverProfile?.fullName || "Driver"}
            </Text>
            <Text style={styles.meta}>
              {driverProfile?.vehicleType || "Vehicle not set"} •{" "}
              {driverProfile?.plateNumber || "Plate not set"}
            </Text>
            <Text style={styles.meta}>{locationLabel}</Text>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <View style={[styles.statusBadge, { backgroundColor: badgeTone.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badgeTone.text }]}>
              {driverProfile?.approvalStatus || "PENDING"}
            </Text>
          </View>

          <OnlineToggle
            value={isOnline}
            loading={loadingToggle}
            disabled={!isApproved || driverProfile?.availability === "BUSY"}
            onToggle={handleToggleOnline}
          />
        </View>
      </View>

      {activeTrip ? (
        <TouchableOpacity
          style={styles.activeTripCard}
          onPress={() =>
            router.push({
              pathname: "/(driver)/active-trip",
              params: { tripId: activeTrip.id },
            })
          }
        >
          <Text style={styles.sectionTitle}>Active Trip</Text>
          <Text style={styles.activeTripStatus}>
            {formatTripStatus(activeTrip.status)}
          </Text>
          <Text style={styles.activeTripRoute}>
            {activeTrip.pickupAddress || "Pickup"} →{" "}
            {activeTrip.dropoffAddress || "Drop-off"}
          </Text>
          <Text style={styles.activeTripMeta}>
            Customer: {activeTrip.customerName || "Customer"}
          </Text>
          <Text style={styles.viewLink}>Open active trip</Text>
        </TouchableOpacity>
      ) : null}

      {!isApproved ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Approval still pending</Text>
          <Text style={styles.noticeText}>
            Your driver account must be approved before you can go online and
            accept jobs.
          </Text>
        </View>
      ) : null}

      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => router.push("/(driver)/jobs")}
        >
          <Text style={styles.quickTitle}>Available Jobs</Text>
          <Text style={styles.quickText}>
            View nearby requests that match your vehicle.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => router.push("/(driver)/profile")}
        >
          <Text style={styles.quickTitle}>Profile</Text>
          <Text style={styles.quickText}>
            Review approval, vehicle, and account details.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => router.push("/(driver)/earnings")}
        >
          <Text style={styles.quickTitle}>Earnings</Text>
          <Text style={styles.quickText}>
            Check delivered trips and your driver summary.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={syncCurrentLocation}
          disabled={syncingLocation}
        >
          <Text style={styles.quickTitle}>Sync Location</Text>
          <Text style={styles.quickText}>
            {syncingLocation
              ? "Syncing..."
              : "Refresh your live driver location."}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Nearby Matching Requests</Text>
        <Text style={styles.sectionSub}>
          Within {MAX_DISTANCE_KM} km of your current location
        </Text>
      </View>

      {nearbyTrips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No nearby requests right now</Text>
          <Text style={styles.emptyText}>
            Go online and keep your location synced to receive matching
            requests.
          </Text>
        </View>
      ) : (
        nearbyTrips.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={styles.tripCard}
            onPress={() => router.push("/(driver)/jobs")}
          >
            <Text style={styles.tripRoute}>
              {trip.pickupAddress || "Pickup"} →{" "}
              {trip.dropoffAddress || "Drop-off"}
            </Text>
            <Text style={styles.tripMeta}>
              Distance to pickup: {trip.distanceToPickupKm.toFixed(2)} km
            </Text>
            <Text style={styles.tripMeta}>
              Vehicle: {(trip as any).vehicleType || "—"} • Load:{" "}
              {(trip as any).loadSize || "—"}
            </Text>
            <Text style={styles.tripMeta}>
              Price: KES{" "}
              {Number((trip as any).estimatedPrice ?? 0).toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))
      )}
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
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
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
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#fff",
    fontSize: 28,
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
  heroBottom: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  activeTripCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  activeTripStatus: {
    marginTop: 8,
    color: "#2563eb",
    fontWeight: "900",
    fontSize: 13,
  },
  activeTripRoute: {
    marginTop: 10,
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  activeTripMeta: {
    marginTop: 6,
    color: "#64748b",
    fontWeight: "700",
  },
  viewLink: {
    marginTop: 12,
    color: "#2563eb",
    fontWeight: "900",
  },
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  noticeTitle: {
    color: "#9a3412",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },
  noticeText: {
    color: "#9a3412",
    lineHeight: 20,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  quickCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    minHeight: 120,
  },
  quickTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },
  quickText: {
    color: "#64748b",
    lineHeight: 19,
  },
  listHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
  },
  sectionSub: {
    color: "#64748b",
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  tripRoute: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 8,
  },
  tripMeta: {
    color: "#64748b",
    marginBottom: 4,
  },
});
