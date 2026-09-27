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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JobPing } from "../../components/driver/JobPing";
import { ListSkeleton } from "../../components/ui/skeleton";
import { design } from "../../constants/design";
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

type DriverJob = Trip & { distanceToPickupKm: number };

function normalizeVehicle(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getVehicleIcon(vehicle?: string | null) {
  const n = normalizeVehicle(vehicle);
  if (n.includes("tuk") || n.includes("rickshaw")) return "rickshaw-electric";
  if (n.includes("pickup")) return "truck-pickup";
  if (n.includes("lorry")) return "truck";
  if (n.includes("truck")) return "truck-fast";
  if (n.includes("bike") || n.includes("boda") || n.includes("motor")) return "motorbike";
  return "truck-fast";
}

function formatVehicleLabel(vehicle?: string | null) {
  return String(vehicle || "Transport Vehicle").replace(/_/g, " ");
}

function formatOfferTime(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DriverJobsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const driver = user?.driverProfile;

  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingTripId, setAcceptingTripId] = useState<string | null>(null);
  const [pingJob, setPingJob] = useState<DriverJob | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isMountedRef = useRef(true);

  const canViewJobs = useMemo(
    () => driver?.availability === "ONLINE" || driver?.availability === "BUSY",
    [driver?.availability],
  );

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiFetch("/drivers/me/nearby-trips");
      const trips: DriverJob[] = Array.isArray(data?.trips) ? data.trips : [];
      setJobs(trips);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load nearby jobs.";
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

  useFocusEffect(useCallback(() => { void refreshAll(); }, [refreshAll]));

  useEffect(() => {
    isMountedRef.current = true;
    Promise.resolve()
      .then(() => { if (isMountedRef.current) return refreshAll(); })
      .finally(() => { if (isMountedRef.current) setLoading(false); });
    return () => { isMountedRef.current = false; };
  }, [refreshAll]);

  useEffect(() => {
    if (!jobs.some((job) => job.expiresAt)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [jobs]);

  useEffect(() => {
    const interval = setInterval(() => { void refreshAll(); }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshAll]);

  useEffect(() => {
    const socket = connectSocket();

    const onNewTripCreated = async (payload: Trip) => {
      if (!payload?.id || !canViewJobs) return;
      try {
        const data = await apiFetch("/drivers/me/nearby-trips");
        const nextJobs: DriverJob[] = Array.isArray(data?.trips) ? data.trips : [];
        setJobs(nextJobs);
        const matchingJob = nextJobs.find((job) => job.id === payload.id);
        if (matchingJob) setPingJob(matchingJob);
      } catch {
        await refreshAll();
      }
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
      if (!trip) { await refreshAll(); return; }
      if (trip.assignedDriverId) await fetchActiveTripAndRedirect();
      await refreshAll();
    };

    const onTripStatusUpdated = async (_payload: TripStatusUpdatedPayload) => { await refreshAll(); };
    const onTripExpired = async (_payload: TripExpiredPayload) => { await refreshAll(); };

    socket.on("new_trip_created", onNewTripCreated);
    socket.on("trip_accepted", onTripAccepted);
    socket.on("trip_updated", onTripUpdated);
    socket.on("trip_status_updated", onTripStatusUpdated);
    socket.on("trip_expired", onTripExpired);

    return () => {
      socket.off("new_trip_created", onNewTripCreated);
      socket.off("trip_accepted", onTripAccepted);
      socket.off("trip_updated", onTripUpdated);
      socket.off("trip_status_updated", onTripStatusUpdated);
      socket.off("trip_expired", onTripExpired);
    };
  }, [canViewJobs, fetchActiveTripAndRedirect, refreshAll]);

  const handleAccept = useCallback(async (tripId: string) => {
    try {
      setAcceptingTripId(tripId);
      const data = await apiFetch(`/trips/${tripId}/accept`, { method: "POST" });
      const acceptedTrip = data?.trip;
      router.replace({
        pathname: "/(driver)/active-trip",
        params: { tripId: acceptedTrip?.id || tripId },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to accept job.";
      Alert.alert("Accept failed", message);
      await refreshAll();
    } finally {
      setAcceptingTripId(null);
    }
  }, [refreshAll]);

  if (loading) return <ListSkeleton rows={4} />;

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.screen}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + design.spacing.sm, paddingBottom: insets.bottom + design.spacing.lg },
        ]}
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
              Stay online, keep location syncing, and fresh matched jobs will land here automatically.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAccepting = acceptingTripId === item.id;
          const icon = getVehicleIcon(item.vehicleType);
          const offerTime = formatOfferTime(item.expiresAt, now);

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons name={icon as any} size={24} color={design.colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
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
                  <Text style={styles.payoutLabel}>Trip fare</Text>
                </View>
              </View>

              {offerTime ? (
                <View style={styles.offerExpiry}>
                  <Ionicons name="time-outline" size={15} color="#A86108" />
                  <Text style={styles.offerExpiryText}>
                    {offerTime === "0:00" ? "Offer expiring — refresh jobs" : `Offer expires in ${offerTime}`}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.label}>Pickup</Text>
              <Text style={styles.value} numberOfLines={2}>{item.pickupAddress}</Text>

              <Text style={styles.label}>Drop-off</Text>
              <Text style={styles.value} numberOfLines={2}>{item.dropoffAddress}</Text>

              <Text style={styles.label}>Load</Text>
              <Text style={styles.value} numberOfLines={2}>
                {item.loadDescription || "General goods"}
              </Text>

              <Text style={styles.label}>Trip Distance</Text>
              <Text style={styles.value}>{Number(item.distanceKm ?? 0).toFixed(1)} km</Text>

              <TouchableOpacity
                style={[styles.btn, (isAccepting || !canViewJobs) && styles.btnDisabled]}
                onPress={() => handleAccept(item.id)}
                disabled={isAccepting || !canViewJobs}
              >
                {isAccepting ? (
                  <ActivityIndicator color={design.colors.white} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={18} color={design.colors.white} />
                    <Text style={styles.btnText}>Accept Job</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
      <JobPing
        key={pingJob?.id ?? "no-offer"}
        job={pingJob}
        accepting={acceptingTripId === pingJob?.id}
        onAccept={(jobId) => { void handleAccept(jobId); setPingJob(null); }}
        onDecline={() => setPingJob(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: design.colors.subtle },
  contentContainer: { paddingHorizontal: design.spacing.md, flexGrow: 1 },
  header: { marginBottom: design.spacing.sm, paddingHorizontal: design.spacing.xs },
  headerTitle: { fontSize: 24, fontWeight: "900", color: design.colors.ink, marginBottom: design.spacing.xs },
  headerSub: { color: design.colors.muted, lineHeight: 20 },
  center: { flex: 1, minHeight: 280, justifyContent: "center", alignItems: "center", paddingHorizontal: design.spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: design.colors.ink, marginBottom: design.spacing.sm },
  emptyText: { textAlign: "center", color: design.colors.muted, lineHeight: 20 },
  card: {
    padding: design.spacing.md,
    marginBottom: design.spacing.md,
    backgroundColor: design.colors.white,
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: design.spacing.sm, gap: design.spacing.sm },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: design.radius.md,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "900", fontSize: 16, color: design.colors.ink },
  subtitle: { color: design.colors.muted, marginTop: design.spacing.xs },
  priceBadge: {
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
  },
  priceBadgeText: { color: design.colors.white, fontWeight: "800", fontSize: 12 },
  payoutLabel: { color: "#CBD5E1", fontSize: 10, fontWeight: "700", marginTop: 2, textAlign: "right" },
  offerExpiry: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.xs,
    backgroundColor: "#FFF3D8",
    borderRadius: design.radius.sm,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
    marginBottom: design.spacing.xs,
  },
  offerExpiryText: { color: "#A86108", fontSize: 12, fontWeight: "800" },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: design.colors.muted,
    marginTop: design.spacing.sm,
    textTransform: "uppercase",
  },
  value: { fontSize: 14, color: design.colors.ink, marginTop: 2, lineHeight: 20 },
  btn: {
    marginTop: design.spacing.md,
    backgroundColor: design.colors.ink,
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: design.spacing.sm,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: design.colors.white, fontWeight: "800" },
});