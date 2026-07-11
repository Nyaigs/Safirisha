import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import { useTripStore } from "../../store/trip";
import type {
  Trip,
  TripAcceptedPayload,
  TripExpiredPayload,
  DriverLocationUpdatedPayload,
} from "../../types/trip";

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

function getSearchPhaseText(phaseIndex: number, vehicleLabel: string, socketConnected: boolean) {
  const prefix = socketConnected ? "Live dispatch" : "Reconnecting";
  const phases = [
    `${prefix}: checking the closest ${vehicleLabel.toLowerCase()} drivers nearby...`,
    `${prefix}: ranking available drivers by distance and freshness...`,
    `${prefix}: sending your request to matching nearby drivers...`,
    `${prefix}: waiting for the first driver to accept...`,
  ];
  return phases[phaseIndex % phases.length];
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

  const safeTripId = useMemo(() => String(tripId || ""), [tripId]);
  const selectedVehicle = useMemo(() => String(vehicle || vehicleType || ""), [vehicle, vehicleType]);
  const vehicleIcon = useMemo(() => getVehicleIcon(selectedVehicle), [selectedVehicle]);
  const vehicleLabel = useMemo(() => getVehicleLabel(selectedVehicle), [selectedVehicle]);

  const [socketConnected, setSocketConnected] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);

  const vehicleTranslateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;
  const hasNavigatedRef = useRef(false);
  const expiresAtRef = useRef<string | null>(null);

  const goToDriverFound = useCallback((payload: TripAcceptedPayload) => {
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
  }, [safeTripId, pickup, dropoff, vehicle, vehicleType, loadSize, estimatedPrice, params]);

  const goHomeAfterCancel = useCallback((message = "Your request has been cancelled successfully.") => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    Alert.alert("Request closed", message, [
      { text: "OK", onPress: () => router.replace("/(customer)/(tabs)") },
    ]);
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
          } catch (error: any) {
            Alert.alert("Cancel failed", error?.message || "Could not cancel this request.");
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
        Animated.timing(vehicleTranslateAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(vehicleTranslateAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    driveLoop.start();
    glowLoop.start();
    return () => { driveLoop.stop(); glowLoop.stop(); };
  }, [vehicleTranslateAnim, glowAnim]);

  useEffect(() => {
    const interval = setInterval(() => setPhaseIndex((prev) => (prev + 1) % 4), 2400);
    return () => clearInterval(interval);
  }, []);

  const statusText = useMemo(
    () => getSearchPhaseText(phaseIndex, vehicleLabel, socketConnected),
    [phaseIndex, socketConnected, vehicleLabel],
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
          const secs = Math.max(0, Math.floor((new Date(trip.expiresAt).getTime() - Date.now()) / 1000));
          setSecondsLeft(secs);
        }

        if (trip.status === "CANCELLED") {
          goHomeAfterCancel(trip.expiredAt ? "Search expired before a driver accepted." : undefined);
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
        /* silent */
      }
    };

    pollTrip();
    const interval = setInterval(pollTrip, 4000);
    return () => { active = false; clearInterval(interval); };
  }, [goHomeAfterCancel, goToDriverFound, safeTripId]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!expiresAtRef.current) return;
      const secs = Math.max(0, Math.floor((new Date(expiresAtRef.current).getTime() - Date.now()) / 1000));
      setSecondsLeft(secs);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const vehicleTranslateX = vehicleTranslateAnim.interpolate({
    inputRange: [0, 1], outputRange: [-145, 145],
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.replace("/(customer)/(tabs)")}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.connectionPill}>
            <View style={[styles.connectionDot, { backgroundColor: socketConnected ? "#22c55e" : "#f59e0b" }]} />
            <Text style={styles.connectionText}>{socketConnected ? "Live Dispatch" : "Reconnecting"}</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.heroBlock}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name={vehicleIcon as any} size={24} color="#ffffff" />
            </View>
            <Text style={styles.heroTitle}>Searching for the best driver</Text>
            <Text style={styles.heroSubtitle}>{statusText}</Text>
          </View>

          <View style={styles.dispatchStatsRow}>
            <View style={styles.dispatchStatCard}>
              <Text style={styles.dispatchStatLabel}>Time Left</Text>
              <Text style={styles.dispatchStatValue}>{formatSecondsLeft(secondsLeft)}</Text>
            </View>
          </View>

          <View style={styles.roadWrap}>
            <Animated.View style={[styles.vehicleBubble, { transform: [{ translateX: vehicleTranslateX }, { scale: glowAnim }] }]}>
              <MaterialCommunityIcons name={vehicleIcon as any} size={34} color="#111827" />
            </Animated.View>
          </View>

          <View style={styles.vehicleInfoCard}>
            <Text style={styles.vehicleInfoLabel}>Requested Vehicle</Text>
            <Text style={styles.vehicleInfoValue}>{vehicleLabel}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Trip Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup</Text>
              <Text style={styles.summaryValue}>{pickup || "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Drop-off</Text>
              <Text style={styles.summaryValue}>{dropoff || "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Load Size</Text>
              <Text style={styles.summaryValue}>{loadSize || "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated Price</Text>
              <Text style={styles.summaryValue}>KES {estimatedPrice || "0"}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
            onPress={handleCancelRequest}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
                <Text style={styles.cancelButtonText}>Cancel Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  connectionPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  connectionDot: { width: 8, height: 8, borderRadius: 999, marginRight: 8 },
  connectionText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  sheet: { flex: 1, backgroundColor: "#ffffff", borderRadius: 28, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  heroBlock: { alignItems: "center", marginBottom: 18 },
  badge: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  heroTitle: { color: "#111827", fontSize: 24, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { color: "#64748b", marginTop: 8, lineHeight: 20, textAlign: "center" },
  dispatchStatsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dispatchStatCard: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  dispatchStatLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  dispatchStatValue: { color: "#111827", fontSize: 15, fontWeight: "900" },
  roadWrap: { height: 120, justifyContent: "center", alignItems: "center", overflow: "hidden", marginBottom: 18 },
  vehicleBubble: { width: 82, height: 82, borderRadius: 28, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  vehicleInfoCard: { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 14 },
  vehicleInfoLabel: { color: "#64748b", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  vehicleInfoValue: { color: "#111827", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: "900", color: "#111827", marginBottom: 12 },
  summaryRow: { marginBottom: 12 },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  summaryValue: { color: "#111827", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  cancelButton: { backgroundColor: "#fff1f2", borderRadius: 16, paddingVertical: 16, borderWidth: 1, borderColor: "#fecdd3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto" },
  cancelButtonText: { color: "#b91c1c", fontWeight: "800", fontSize: 15 },
  buttonDisabled: { opacity: 0.7 },
});
