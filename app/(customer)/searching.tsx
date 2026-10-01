import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { useLayout } from "../../constants/layout";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import type { Trip, TripAcceptedPayload, TripExpiredPayload } from "../../types/trip";

function normalizeVehicle(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function getVehicleIcon(vehicle?: string) {
  const normalized = normalizeVehicle(vehicle);
  if (normalized.includes("tuk") || normalized.includes("rickshaw")) return "rickshaw-electric";
  if (normalized.includes("pickup")) return "truck-cargo-container";
  if (normalized.includes("lorry")) return "truck";
  if (normalized.includes("truck")) return "truck-fast";
  if (normalized.includes("bike") || normalized.includes("boda") || normalized.includes("motor")) return "motorbike";
  return "truck-fast";
}

function getVehicleLabel(vehicle?: string) {
  const normalized = normalizeVehicle(vehicle);
  if (normalized.includes("tuk") || normalized.includes("rickshaw")) return "Tuk Tuk";
  if (normalized.includes("pickup")) return "Pickup";
  if (normalized.includes("lorry")) return "Lorry";
  if (normalized.includes("truck")) return "Truck";
  if (normalized.includes("bike") || normalized.includes("boda") || normalized.includes("motor")) return "Motorbike";
  return "Transport Vehicle";
}

function formatSecondsLeft(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getSearchStatusText(vehicleLabel: string, socketConnected: boolean) {
  return socketConnected
    ? `Looking for the closest ${vehicleLabel.toLowerCase()} driver near you…`
    : "Live updates unavailable. We'll keep checking your request.";
}

export default function SearchingScreen() {
  const params = useLocalSearchParams<{
    tripId?: string;
    pickup?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoff?: string;
    dropoffLat?: string;
    dropoffLng?: string;
    vehicle?: string;
    vehicleType?: string;
    loadDescription?: string;
    loadSize?: string;
    specialNotes?: string;
    estimatedPrice?: string;
    distanceKm?: string;
  }>();

  const { tripId, pickup, dropoff, vehicle, vehicleType, loadSize, estimatedPrice } = params;

  const insets = useSafeAreaInsets();
  const { spacing } = useLayout();

  const safeTripId = useMemo(() => String(tripId || ""), [tripId]);
  const selectedVehicle = useMemo(() => String(vehicle || vehicleType || ""), [vehicle, vehicleType]);
  const vehicleIcon = useMemo(() => getVehicleIcon(selectedVehicle), [selectedVehicle]);
  const vehicleLabel = useMemo(() => getVehicleLabel(selectedVehicle), [selectedVehicle]);

  const [socketConnected, setSocketConnected] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);

  const [vehicleTranslateAnim] = useState(() => new Animated.Value(0));
  const [glowAnim] = useState(() => new Animated.Value(1));
  const [pulseAnim] = useState(() => new Animated.Value(0));
  const hasNavigatedRef = useRef(false);
  const expiresAtRef = useRef<string | null>(null);

  const goToDriverFound = useCallback(
    (payload: TripAcceptedPayload) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      router.replace({
        pathname: "/(customer)/driver-found",
        params: {
          tripId: payload.tripId || safeTripId,
          driverId: payload.driver?.id || "",
          driverName: payload.driver?.name || "Assigned Driver",
          driverPhone: payload.driver?.phone || "",
          plateNumber: payload.driver?.plateNumber || "",
          driverVehicleType: payload.driver?.vehicleType || "",
          status: payload.status || "ACCEPTED",
          pickup,
          pickupLat: params.pickupLat,
          pickupLng: params.pickupLng,
          dropoff,
          dropoffLat: params.dropoffLat,
          dropoffLng: params.dropoffLng,
          vehicle,
          vehicleType,
          loadDescription: params.loadDescription,
          loadSize,
          specialNotes: params.specialNotes,
          estimatedPrice,
          distanceKm: params.distanceKm,
        },
      });
    },
    [safeTripId, pickup, dropoff, vehicle, vehicleType, loadSize, estimatedPrice, params],
  );

  const goHomeAfterCancel = useCallback(
    (message = "Your request has been cancelled successfully.") => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      Alert.alert("Request closed", message, [
        { text: "OK", onPress: () => router.replace("/(customer)/(tabs)") },
      ]);
    },
    [],
  );

  const handleTryAgain = useCallback(() => {
    router.replace("/(customer)/(tabs)");
  }, []);

  const handleCancelRequest = useCallback(async () => {
    if (!safeTripId) {
      Alert.alert("Missing trip", "Trip ID is missing.");
      return;
    }
    Alert.alert("Cancel request", "Do you want to cancel this transport request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);
            await apiFetch(`/trips/${safeTripId}/cancel`, { method: "PATCH" });
            goHomeAfterCancel();
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Could not cancel this request.";
            Alert.alert("Cancel failed", message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }, [goHomeAfterCancel, safeTripId]);

  useEffect(() => {
    const driveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(vehicleTranslateAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(vehicleTranslateAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );

    driveLoop.start();
    glowLoop.start();
    pulseLoop.start();

    return () => {
      driveLoop.stop();
      glowLoop.stop();
      pulseLoop.stop();
    };
  }, [vehicleTranslateAnim, glowAnim, pulseAnim]);

  const statusText = useMemo(
    () => getSearchStatusText(vehicleLabel, socketConnected),
    [socketConnected, vehicleLabel],
  );

  useEffect(() => {
    if (!safeTripId) {
      Alert.alert("Missing trip", "Trip ID is missing for this request.");
      return;
    }

    const socket = connectSocket();

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_trip_room", safeTripId);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onTripAccepted = (payload: TripAcceptedPayload) => {
      if (!payload?.tripId || payload.tripId !== safeTripId) return;
      goToDriverFound(payload);
    };

    const onTripExpired = (payload: TripExpiredPayload) => {
      if (!payload?.tripId || payload.tripId !== safeTripId) return;
      goHomeAfterCancel("No driver accepted in time. Please try again.");
    };

    const onTripStatusUpdated = (payload: { tripId: string; status: string }) => {
      if (payload.tripId !== safeTripId) return;
      if (payload.status === "CANCELLED") goHomeAfterCancel();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("trip_accepted", onTripAccepted);
    socket.on("trip_expired", onTripExpired);
    socket.on("trip_status_updated", onTripStatusUpdated);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("trip_accepted", onTripAccepted);
      socket.off("trip_expired", onTripExpired);
      socket.off("trip_status_updated", onTripStatusUpdated);
      socket.emit("leave_trip_room", safeTripId);
    };
  }, [goHomeAfterCancel, goToDriverFound, safeTripId]);

  useEffect(() => {
    if (!safeTripId) return;
    let active = true;

    const pollTrip = async () => {
      try {
        const data = await apiFetch(`/trips/${safeTripId}`);
        const trip = data?.trip as Trip | undefined;
        if (!active || !trip) return;

        expiresAtRef.current = trip.expiresAt || null;

        if (trip.expiresAt) {
          const secs = Math.max(
            0,
            Math.floor((new Date(trip.expiresAt).getTime() - Date.now()) / 1000),
          );
          setSecondsLeft(secs);
        }

        if (trip.status === "CANCELLED") {
          goHomeAfterCancel(
            trip.expiredAt ? "Search expired before a driver accepted." : undefined,
          );
          return;
        }

        if (trip.status === "ACCEPTED" && trip.assignedDriver) {
          goToDriverFound({
            tripId: trip.id,
            status: trip.status,
            driver: {
              id: trip.assignedDriver.id || "",
              name: trip.assignedDriver.user?.fullName || "Assigned Driver",
              phone: trip.assignedDriver.user?.phone || "",
              plateNumber: trip.assignedDriver.plateNumber || "",
              vehicleType: trip.assignedDriver.vehicleType || "",
            },
          });
        }
      } catch {
        /* silent — a subsequent poll will retry */
      }
    };

    pollTrip();
    const interval = setInterval(pollTrip, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [goHomeAfterCancel, goToDriverFound, safeTripId]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!expiresAtRef.current) return;
      const secs = Math.max(
        0,
        Math.floor((new Date(expiresAtRef.current).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(secs);
      if (secs === 0) setTimedOut(true);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const vehicleTranslateX = vehicleTranslateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-145, 145],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.6],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });

  const connectionColor = socketConnected ? design.colors.success : "#f59e0b";
  const connectionLabel = socketConnected ? "Live dispatch" : "Reconnecting";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.replace("/(customer)/(tabs)")}
            accessibilityRole="button"
            accessibilityLabel="Close searching screen"
          >
            <Ionicons name="chevron-back" size={22} color={design.colors.ink} />
          </TouchableOpacity>

          <View style={styles.connectionPill}>
            <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
            <Text style={styles.connectionText}>{connectionLabel}</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.heroBlock}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name={vehicleIcon as any} size={24} color={design.colors.white} />
            </View>
            <Text style={styles.heroTitle}>Finding your driver</Text>
            <Text style={styles.heroSubtitle}>{statusText}</Text>
          </View>

          <View style={styles.roadWrap}>
            <View style={styles.radar}>
              <Animated.View
                style={[
                  styles.radarRing,
                  { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                ]}
              />
              <Animated.View
                style={[styles.vehicleBubble, { transform: [{ translateX: vehicleTranslateX }, { scale: glowAnim }] }]}
              >
                <MaterialCommunityIcons name={vehicleIcon as any} size={34} color={design.colors.ink} />
              </Animated.View>
            </View>
          </View>

          <View style={styles.dispatchStatsRow}>
            <View style={styles.dispatchStatCard}>
              <Text style={styles.dispatchStatLabel}>Time left</Text>
              <Text style={styles.dispatchStatValue}>{formatSecondsLeft(secondsLeft)}</Text>
            </View>
            <View style={styles.dispatchStatCard}>
              <Text style={styles.dispatchStatLabel}>Vehicle</Text>
              <Text style={styles.dispatchStatValue} numberOfLines={1}>
                {vehicleLabel}
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Trip summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {pickup || "—"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Drop-off</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {dropoff || "—"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Load size</Text>
              <Text style={styles.summaryValue}>{loadSize || "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated price</Text>
              <Text style={styles.summaryValue}>KES {estimatedPrice || "0"}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
            onPress={handleCancelRequest}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel="Cancel request"
          >
            {cancelling ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
                <Text style={styles.cancelButtonText}>Cancel request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {timedOut && (
          <View style={styles.timeoutOverlay}>
            <View style={styles.timeoutCard}>
              <View style={styles.timeoutIcon}>
                <Ionicons name="alert-circle-outline" size={44} color={design.colors.muted} />
              </View>
              <Text style={styles.timeoutTitle}>No drivers found</Text>
              <Text style={styles.timeoutSubtitle}>
                We couldn&apos;t find a {vehicleLabel} near your pickup point. Try again or book later.
              </Text>
              <TouchableOpacity style={styles.timeoutPrimary} onPress={handleTryAgain}>
                <Text style={styles.timeoutPrimaryText}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeoutSecondary} onPress={handleCancelRequest}>
                <Text style={styles.timeoutSecondaryText}>Cancel request</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: design.colors.subtle,
  },
  container: {
    flex: 1,
    paddingHorizontal: design.spacing.md,
    paddingTop: design.spacing.sm,
    paddingBottom: design.spacing.md,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: design.spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: design.spacing.sm,
  },
  connectionText: {
    color: design.colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  sheet: {
    flex: 1,
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.xl,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  heroBlock: {
    alignItems: "center",
    marginBottom: design.spacing.md,
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.ink,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: design.spacing.md,
  },
  heroTitle: {
    color: design.colors.ink,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  heroSubtitle: {
    color: design.colors.muted,
    marginTop: design.spacing.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  roadWrap: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: design.spacing.md,
  },
  radar: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  radarRing: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 999,
    backgroundColor: design.colors.brand,
  },
  vehicleBubble: {
    width: 82,
    height: 82,
    borderRadius: design.radius.xl,
    backgroundColor: design.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    ...design.shadow,
  },
  dispatchStatsRow: {
    flexDirection: "row",
    gap: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  dispatchStatCard: {
    flex: 1,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dispatchStatLabel: {
    color: design.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: design.spacing.xs,
  },
  dispatchStatValue: {
    color: design.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  summaryCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.xl,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: design.colors.ink,
    marginBottom: design.spacing.sm,
  },
  summaryRow: {
    marginBottom: design.spacing.md,
  },
  summaryLabel: {
    color: design.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: design.spacing.xs,
  },
  summaryValue: {
    color: design.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: "#fff1f2",
    borderRadius: design.radius.lg,
    paddingVertical: design.spacing.md,
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
    marginTop: "auto",
  },
  cancelButtonText: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  timeoutOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: design.spacing.lg,
  },
  timeoutCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.xl,
    padding: design.spacing.lg,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  timeoutIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: design.colors.subtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: design.spacing.md,
  },
  timeoutTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: design.colors.ink,
    marginBottom: design.spacing.xs,
    textAlign: "center",
  },
  timeoutSubtitle: {
    fontSize: 14,
    color: design.colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: design.spacing.lg,
  },
  timeoutPrimary: {
    backgroundColor: design.colors.brand,
    paddingVertical: design.spacing.md,
    paddingHorizontal: design.spacing.lg,
    borderRadius: design.radius.lg,
    alignItems: "center",
    width: "100%",
    marginBottom: design.spacing.sm,
  },
  timeoutPrimaryText: {
    color: design.colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  timeoutSecondary: {
    paddingVertical: design.spacing.md,
    paddingHorizontal: design.spacing.lg,
    borderRadius: design.radius.lg,
    alignItems: "center",
    width: "100%",
  },
  timeoutSecondaryText: {
    color: design.colors.muted,
    fontWeight: "700",
    fontSize: 14,
  },
});