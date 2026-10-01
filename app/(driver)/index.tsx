import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { apiFetch } from "../../lib/api";
import { connectSocket, onDriverAvailabilityUpdated } from "../../lib/socket";
import { useDriverStore } from "../../store/driver";
import type { Trip } from "../../types/trip";

function getVehicleIcon(vehicle?: string | null) {
  if (!vehicle) return "truck-fast";
  const v = vehicle.toLowerCase();
  if (v.includes("tuk") || v.includes("rickshaw")) return "rickshaw-electric";
  if (v.includes("pickup")) return "truck-cargo-container";
  if (v.includes("lorry") || v.includes("truck")) return "truck";
  if (v.includes("bike") || v.includes("boda") || v.includes("motor")) return "motorbike";
  return "truck-fast";
}

function formatVehicle(vehicle?: string | null) {
  if (!vehicle) return "Vehicle";
  return vehicle.replace(/_/g, " ");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DriverDashboard() {
  const insets = useSafeAreaInsets();
  const driverProfile = useDriverStore((s) => s.driverProfile);
  const activeTrip = useDriverStore((s) => s.activeTrip);
  const isOnline = useDriverStore((s) => s.isOnline);
  const isLoading = useDriverStore((s) => s.isLoading);
  const isToggling = useDriverStore((s) => s.isToggling);
  const error = useDriverStore((s) => s.error);
  const initialize = useDriverStore((s) => s.initialize);
  const goOnline = useDriverStore((s) => s.goOnline);
  const goOffline = useDriverStore((s) => s.goOffline);
  const setActiveTrip = useDriverStore((s) => s.setActiveTrip);

  const [refreshing, setRefreshing] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Location unavailable");
  const [lastGpsAt, setLastGpsAt] = useState<number | null>(null);
  const [gpsClock, setGpsClock] = useState(() => Date.now());
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setInterval(() => setGpsClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const gpsIsStale = lastGpsAt === null || gpsClock - lastGpsAt > 90_000;

  const vehicleIcon = useMemo(
    () => getVehicleIcon(driverProfile?.vehicleType),
    [driverProfile?.vehicleType],
  );

  useEffect(() => { initialize(); }, [initialize]);

  useFocusEffect(
    useCallback(() => { initialize(); }, [initialize]),
  );

  useEffect(() => {
    return onDriverAvailabilityUpdated((payload) => {
      if (!payload?.driverId || payload.driverId !== driverProfile?.id) return;
      const online = payload.availability === "ONLINE" || payload.availability === "BUSY";
      useDriverStore.getState().setOnline(online);
    });
  }, [driverProfile?.id]);

  useEffect(() => {
    const socket = connectSocket();
    const handler = (payload: { trip?: Trip }) => {
      if (payload?.trip) setActiveTrip(payload.trip);
    };
    socket.on("trip_updated", handler);
    return () => { socket.off("trip_updated", handler); };
  }, [setActiveTrip]);

  const stopLocationTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const startLocationTracking = useCallback(async (): Promise<boolean> => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return false;
    watchRef.current?.remove();

    let loc: Location.LocationObject;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLastGpsAt(loc.timestamp || Date.now());
      await apiFetch("/drivers/me/location", {
        method: "PATCH",
        body: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      });
    } catch {
      setLocationLabel("Location unavailable");
      return false;
    }

    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const place = places?.[0];
      if (place) {
        const parts = [place.city, place.region, place.country].filter(Boolean);
        if (parts.length) setLocationLabel(parts.join(", "));
      }
    } catch {
      setLocationLabel("Location available");
    }

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 0 },
      async (l) => {
        setLastGpsAt(l.timestamp || Date.now());
        try {
          await apiFetch("/drivers/me/location", {
            method: "PATCH",
            body: { lat: l.coords.latitude, lng: l.coords.longitude },
          });
        } catch { /* silent — next tick retries */ }
      },
    );
    return true;
  }, []);

  useEffect(() => {
    if (!isOnline) { stopLocationTracking(); return; }
    let active = true;
    void Promise.resolve().then(() => { if (active) return startLocationTracking(); });
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") startLocationTracking();
      else stopLocationTracking();
    });
    return () => {
      active = false;
      stopLocationTracking();
      sub.remove();
    };
  }, [isOnline, startLocationTracking, stopLocationTracking]);

  // Heartbeat: force-refresh location every 45s while online.
  // iOS throttles watchPositionAsync when stationary, so this guarantees
  // lastLocationAt stays fresh enough for dispatch (< 2 min threshold).
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setLastGpsAt(loc.timestamp || Date.now());
        await apiFetch("/drivers/me/location", {
          method: "PATCH",
          body: { lat: loc.coords.latitude, lng: loc.coords.longitude },
        });
      } catch {
        // silent — next tick retries
      }
    };

    void ping();
    const id = setInterval(() => { void ping(); }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOnline]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    if (isOnline) pulse.start();
    else pulseAnim.setValue(1);
    return () => pulse.stop();
  }, [isOnline, pulseAnim]);

  const handleToggle = useCallback(async () => {
    if (isToggling) return;
    try {
      if (isOnline) {
        await goOffline();
        stopLocationTracking();
      } else {
        const hasLocation = await startLocationTracking();
        if (!hasLocation) {
          Alert.alert(
            "Location required",
            "Enable location access and wait for a valid GPS fix before going online.",
          );
          return;
        }
        await goOnline();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not change availability";
      Alert.alert("Toggle failed", message);
    }
  }, [isOnline, isToggling, goOnline, goOffline, startLocationTracking, stopLocationTracking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initialize();
    setRefreshing(false);
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={design.colors.brand} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error && !driverProfile) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={design.colors.muted} />
        <Text style={styles.errorTitle}>Could not load dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={initialize}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + design.spacing.lg, paddingBottom: insets.bottom + design.spacing.xl },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {getGreeting()}, {driverProfile?.fullName?.split(" ")[0] || "Driver"}
          </Text>
          <View style={styles.vehicleRow}>
            <MaterialCommunityIcons name={vehicleIcon as any} size={16} color={design.colors.muted} />
            <Text style={styles.vehicleText}>
              {formatVehicle(driverProfile?.vehicleType)}
              {driverProfile?.plateNumber ? ` • ${driverProfile.plateNumber}` : ""}
            </Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(driverProfile?.fullName || "D").charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.statusCard, isOnline ? styles.statusOnline : styles.statusOffline]}>
        <View style={styles.statusTop}>
          <View style={styles.statusLeft}>
            <Animated.View
              style={[
                styles.statusDot,
                { opacity: pulseAnim },
                isOnline ? styles.dotOnline : styles.dotOffline,
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>
                {isOnline ? "You are online" : "You are offline"}
              </Text>
              <Text style={styles.statusSub}>
                {isOnline
                  ? "Receiving job requests in real-time"
                  : "Go online to start receiving jobs"}
              </Text>
              {isOnline && gpsIsStale ? (
                <Pressable
                  style={styles.gpsWarning}
                  onPress={() => void startLocationTracking()}
                  accessibilityRole="button"
                >
                  <Text style={styles.gpsWarningText}>Waiting for GPS… Retry</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.availabilityBadge}>
            <Text
              style={[
                styles.availabilityBadgeText,
                isOnline ? styles.badgeOnlineText : styles.badgeOfflineText,
              ]}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.toggleButton,
            isOnline ? styles.toggleOnline : styles.toggleOffline,
            pressed && styles.togglePressed,
          ]}
          onPress={handleToggle}
          disabled={isToggling}
        >
          {isToggling ? (
            <ActivityIndicator color={design.colors.white} size="small" />
          ) : (
            <>
              <Ionicons
                name={isOnline ? "power" : "power-outline"}
                size={18}
                color={design.colors.white}
              />
              <Text style={styles.toggleText}>
                {isOnline ? "Tap to go offline" : "Tap to go online"}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="cash" size={22} color={design.colors.success} />
          <Text style={styles.statValue}>KES 0</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="briefcase-check" size={22} color={design.colors.brand} />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Jobs Done</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="star" size={22} color="#D97706" />
          <Text style={styles.statValue}>5.0</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {activeTrip ? (
        <Pressable
          style={({ pressed }) => [styles.activeTripCard, pressed && styles.cardPressed]}
          onPress={() =>
            router.push({
              pathname: "/(driver)/active-trip",
              params: { tripId: activeTrip.id },
            })
          }
        >
          <View style={styles.activeTripTop}>
            <View style={styles.activeTripIcon}>
              <Ionicons name="navigate" size={20} color={design.colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTripLabel}>Active Trip</Text>
              <Text style={styles.activeTripStatus}>
                {activeTrip.status?.replace(/_/g, " ") || "In progress"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={design.colors.muted} />
          </View>
          <View style={styles.activeTripRoute}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </View>
          <View style={styles.activeTripAddresses}>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeTrip.pickupAddress}
            </Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeTrip.dropoffAddress}
            </Text>
          </View>
          <View style={styles.activeTripBottom}>
            <Text style={styles.activeTripPrice}>
              KES {Number(activeTrip.estimatedPrice || 0).toLocaleString()}
            </Text>
            <Text style={styles.activeTripView}>View Trip →</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.locationCard}>
        <Ionicons name="location-outline" size={16} color={design.colors.muted} />
        <Text style={styles.locationText}>{locationLabel}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: design.colors.subtle },
  content: { paddingHorizontal: design.spacing.lg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: design.colors.subtle,
    paddingHorizontal: design.spacing.xl,
  },
  loadingText: { marginTop: design.spacing.md, fontSize: 15, fontWeight: "600", color: design.colors.muted },
  errorTitle: { marginTop: design.spacing.md, fontSize: 18, fontWeight: "800", color: design.colors.ink },
  errorText: { marginTop: design.spacing.sm, fontSize: 14, color: design.colors.muted, textAlign: "center", lineHeight: 20 },
  retryButton: {
    marginTop: design.spacing.lg,
    backgroundColor: design.colors.brand,
    paddingHorizontal: design.spacing.lg,
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.md,
  },
  retryButtonText: { color: design.colors.white, fontWeight: "800", fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: design.spacing.lg,
  },
  headerLeft: { flex: 1, marginRight: design.spacing.md },
  greeting: { fontSize: 24, fontWeight: "900", color: design.colors.ink, marginBottom: design.spacing.xs },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: design.spacing.xs },
  vehicleText: { fontSize: 14, color: design.colors.muted, fontWeight: "600" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: design.colors.white, fontSize: 20, fontWeight: "900" },
  statusCard: { borderRadius: design.radius.lg, padding: design.spacing.lg, marginBottom: design.spacing.md, borderWidth: 1 },
  statusOnline: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  statusOffline: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statusTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: design.spacing.md },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: design.spacing.sm, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotOnline: { backgroundColor: "#16A34A" },
  dotOffline: { backgroundColor: "#DC2626" },
  statusLabel: { fontSize: 17, fontWeight: "800", color: design.colors.ink },
  statusSub: { fontSize: 13, color: design.colors.muted, marginTop: 2, fontWeight: "500" },
  gpsWarning: {
    marginTop: design.spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: design.radius.sm,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
  },
  gpsWarningText: { color: "#854d0e", fontWeight: "800" },
  availabilityBadge: {
    backgroundColor: design.colors.white,
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  availabilityBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  badgeOnlineText: { color: "#16A34A" },
  badgeOfflineText: { color: "#DC2626" },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.lg,
  },
  toggleOnline: { backgroundColor: "#16A34A" },
  toggleOffline: { backgroundColor: "#DC2626" },
  togglePressed: { opacity: 0.8 },
  toggleText: { color: design.colors.white, fontWeight: "800", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: design.spacing.sm, marginBottom: design.spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: design.colors.white,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: { fontSize: 18, fontWeight: "900", color: design.colors.ink, marginTop: design.spacing.sm },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: design.colors.muted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  activeTripCard: {
    backgroundColor: design.colors.white,
    borderRadius: design.radius.lg,
    padding: design.spacing.lg,
    marginBottom: design.spacing.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardPressed: { opacity: 0.7 },
  activeTripTop: { flexDirection: "row", alignItems: "center", gap: design.spacing.md, marginBottom: design.spacing.md },
  activeTripIcon: {
    width: 40,
    height: 40,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  activeTripLabel: { fontSize: 12, fontWeight: "700", color: design.colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  activeTripStatus: {
    fontSize: 16,
    fontWeight: "900",
    color: design.colors.ink,
    marginTop: 2,
    textTransform: "capitalize",
  },
  activeTripRoute: { flexDirection: "row", alignItems: "center", marginBottom: design.spacing.sm, paddingHorizontal: design.spacing.xs },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A" },
  routeDotEnd: { backgroundColor: "#DC2626" },
  routeLine: { flex: 1, height: 2, backgroundColor: "#CBD5E1", marginHorizontal: design.spacing.xs },
  activeTripAddresses: { gap: design.spacing.xs, marginBottom: design.spacing.sm },
  addressText: { fontSize: 13, color: design.colors.muted, fontWeight: "600" },
  activeTripBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: design.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  activeTripPrice: { fontSize: 18, fontWeight: "900", color: design.colors.success },
  activeTripView: { fontSize: 14, fontWeight: "800", color: design.colors.brand },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: design.colors.white,
    borderRadius: design.radius.md,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  locationText: { fontSize: 13, color: design.colors.muted, fontWeight: "600", flex: 1 },
});