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

type AcceptedPayload = {
  tripId: string;
  status: string;
  driver: {
    id: string;
    name: string;
    phone: string;
    plateNumber: string;
    vehicleType: string;
  } | null;
};

function normalizeVehicle(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getVehicleIcon(vehicle?: string) {
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

function getVehicleLabel(vehicle?: string) {
  const normalized = normalizeVehicle(vehicle);

  if (normalized.includes("tuk") || normalized.includes("rickshaw")) {
    return "Tuk Tuk";
  }

  if (normalized.includes("pickup")) {
    return "Pickup";
  }

  if (normalized.includes("lorry")) {
    return "Lorry";
  }

  if (normalized.includes("truck")) {
    return "Truck";
  }

  if (
    normalized.includes("bike") ||
    normalized.includes("boda") ||
    normalized.includes("motor")
  ) {
    return "Motorbike";
  }

  return "Transport Vehicle";
}

function getVehicleStatusText(vehicle?: string) {
  const normalized = normalizeVehicle(vehicle);

  if (normalized.includes("tuk") || normalized.includes("rickshaw")) {
    return "Matching your request with nearby tuk tuk transporters.";
  }

  if (normalized.includes("pickup")) {
    return "Matching your request with nearby pickup drivers.";
  }

  if (normalized.includes("lorry")) {
    return "Looking for a nearby lorry that fits this load.";
  }

  if (normalized.includes("truck")) {
    return "Looking for a nearby truck for your request.";
  }

  if (
    normalized.includes("bike") ||
    normalized.includes("boda") ||
    normalized.includes("motor")
  ) {
    return "Checking for a nearby motorbike transporter.";
  }

  return "Matching your request with nearby transporters.";
}

export default function SearchingScreen() {
  const params = useLocalSearchParams<{
    tripId?: string;
    requestId?: string;
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

  const {
    tripId,
    requestId,
    pickup,
    pickupLat,
    pickupLng,
    dropoff,
    dropoffLat,
    dropoffLng,
    vehicle,
    vehicleType,
    loadDescription,
    loadSize,
    specialNotes,
    estimatedPrice,
    distanceKm,
  } = params;

  const [socketConnected, setSocketConnected] = useState(false);
  const [statusText, setStatusText] = useState(
    getVehicleStatusText(vehicle || vehicleType),
  );
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const safeTripId = useMemo(() => String(tripId || ""), [tripId]);

  const selectedVehicle = useMemo(
    () => String(vehicle || vehicleType || ""),
    [vehicle, vehicleType],
  );

  const vehicleIcon = useMemo(
    () => getVehicleIcon(selectedVehicle),
    [selectedVehicle],
  );

  const vehicleLabel = useMemo(
    () => getVehicleLabel(selectedVehicle),
    [selectedVehicle],
  );

  const vehicleTranslateAnim = useRef(new Animated.Value(0)).current;
  const wheelBounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;
  const pulseLineAnim = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  const routeParamsRef = useRef({
    requestId: String(requestId || ""),
    pickup: String(pickup || ""),
    pickupLat: String(pickupLat || ""),
    pickupLng: String(pickupLng || ""),
    dropoff: String(dropoff || ""),
    dropoffLat: String(dropoffLat || ""),
    dropoffLng: String(dropoffLng || ""),
    vehicle: String(vehicle || ""),
    vehicleType: String(vehicleType || ""),
    loadDescription: String(loadDescription || ""),
    loadSize: String(loadSize || ""),
    specialNotes: String(specialNotes || ""),
    estimatedPrice: String(estimatedPrice || "0"),
    distanceKm: String(distanceKm || "0"),
  });

  useEffect(() => {
    routeParamsRef.current = {
      requestId: String(requestId || ""),
      pickup: String(pickup || ""),
      pickupLat: String(pickupLat || ""),
      pickupLng: String(pickupLng || ""),
      dropoff: String(dropoff || ""),
      dropoffLat: String(dropoffLat || ""),
      dropoffLng: String(dropoffLng || ""),
      vehicle: String(vehicle || ""),
      vehicleType: String(vehicleType || ""),
      loadDescription: String(loadDescription || ""),
      loadSize: String(loadSize || ""),
      specialNotes: String(specialNotes || ""),
      estimatedPrice: String(estimatedPrice || "0"),
      distanceKm: String(distanceKm || "0"),
    };
  }, [
    requestId,
    pickup,
    pickupLat,
    pickupLng,
    dropoff,
    dropoffLat,
    dropoffLng,
    vehicle,
    vehicleType,
    loadDescription,
    loadSize,
    specialNotes,
    estimatedPrice,
    distanceKm,
  ]);

  const goToDriverFound = useCallback(
    (payload: AcceptedPayload) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      const current = routeParamsRef.current;

      router.replace({
        pathname: "/(customer)/driver-found",
        params: {
          tripId: payload.tripId || safeTripId,
          requestId: current.requestId,
          pickup: current.pickup,
          pickupLat: current.pickupLat,
          pickupLng: current.pickupLng,
          dropoff: current.dropoff,
          dropoffLat: current.dropoffLat,
          dropoffLng: current.dropoffLng,
          vehicle: current.vehicle,
          vehicleType: current.vehicleType,
          loadDescription: current.loadDescription,
          loadSize: current.loadSize,
          specialNotes: current.specialNotes,
          estimatedPrice: current.estimatedPrice,
          distanceKm: current.distanceKm,
          driverId: payload.driver?.id || "",
          driverName: payload.driver?.name || "Assigned Driver",
          driverPhone: payload.driver?.phone || "",
          plateNumber: payload.driver?.plateNumber || "",
          driverVehicleType: payload.driver?.vehicleType || "",
          status: payload.status || "ACCEPTED",
        },
      });
    },
    [safeTripId],
  );

  const goHomeAfterCancel = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    Alert.alert(
      "Request cancelled",
      "Your request has been cancelled successfully.",
      [
        {
          text: "OK",
          onPress: () => router.replace("/(customer)/(tabs)"),
        },
      ],
    );
  }, []);

  const handleCancelRequest = useCallback(async () => {
    if (!safeTripId) {
      Alert.alert("Missing trip", "Trip ID is missing.");
      return;
    }

    Alert.alert(
      "Cancel request",
      "Do you want to cancel this transport request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              await apiFetch(`/trips/${safeTripId}/cancel`, {
                method: "PATCH",
              });
              goHomeAfterCancel();
            } catch (error: any) {
              Alert.alert(
                "Cancel failed",
                error?.message || "Could not cancel this request.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
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

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wheelBounceAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(wheelBounceAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.linear,
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

    const pulseLineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseLineAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseLineAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );

    driveLoop.start();
    bounceLoop.start();
    glowLoop.start();
    pulseLineLoop.start();

    return () => {
      driveLoop.stop();
      bounceLoop.stop();
      glowLoop.stop();
      pulseLineLoop.stop();
    };
  }, [vehicleTranslateAnim, wheelBounceAnim, glowAnim, pulseLineAnim]);

  useEffect(() => {
    const phases = [
      "Checking nearby drivers...",
      "Matching the right vehicle for your load...",
      "Sending your request live to available drivers...",
      "Waiting for the first nearby driver to accept...",
    ];

    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % phases.length);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socketConnected) {
      setStatusText("Connecting to live updates...");
      return;
    }

    const connectedPhases = [
      "Connected live. Checking nearby drivers...",
      "Connected live. Matching the right vehicle...",
      "Connected live. Sending request to nearby drivers...",
      "Connected live. Waiting for driver acceptance...",
    ];

    setStatusText(connectedPhases[phaseIndex]);
  }, [phaseIndex, socketConnected]);

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
      setStatusText("Connection lost. Reconnecting to live updates...");
    };

    const onTripAccepted = (payload: AcceptedPayload) => {
      if (!payload?.tripId || payload.tripId !== safeTripId) return;
      goToDriverFound(payload);
    };

    const onTripStatusUpdated = (payload: {
      tripId: string;
      status: string;
    }) => {
      if (payload.tripId !== safeTripId) return;

      if (payload.status === "CANCELLED") {
        goHomeAfterCancel();
        return;
      }

      if (payload.status === "ACCEPTED") {
        setStatusText("A driver has accepted your request.");
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("trip_accepted", onTripAccepted);
    socket.on("trip_status_updated", onTripStatusUpdated);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("trip_accepted", onTripAccepted);
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
        const trip = data?.trip;

        if (!active || !trip) return;

        if (trip.status === "CANCELLED") {
          goHomeAfterCancel();
          return;
        }

        if (trip.status === "ACCEPTED" && trip.assignedDriver) {
          goToDriverFound({
            tripId: trip.id || safeTripId,
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
      } catch (error) {
        console.log("Trip polling failed", error);
      }
    };

    pollTrip();
    const interval = setInterval(pollTrip, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [goHomeAfterCancel, goToDriverFound, safeTripId]);

  const vehicleTranslateX = vehicleTranslateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-145, 145],
  });

  const vehicleTranslateY = wheelBounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const roadOpacity = pulseLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.replace("/(customer)/(tabs)")}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.connectionPill}>
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: socketConnected ? "#22c55e" : "#f59e0b" },
              ]}
            />
            <Text style={styles.connectionText}>
              {socketConnected ? "Live" : "Reconnecting"}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.heroBlock}>
            <View style={styles.badge}>
              <MaterialCommunityIcons
                name={vehicleIcon as any}
                size={24}
                color="#ffffff"
              />
            </View>

            <Text style={styles.heroTitle}>Finding your driver</Text>
            <Text style={styles.heroSubtitle}>{statusText}</Text>
          </View>

          <View style={styles.roadWrap}>
            <Animated.View
              style={[
                styles.roadLine,
                {
                  opacity: roadOpacity,
                },
              ]}
            />
            <View style={styles.roadDashRow}>
              <View style={styles.roadDash} />
              <View style={styles.roadDash} />
              <View style={styles.roadDash} />
              <View style={styles.roadDash} />
              <View style={styles.roadDash} />
            </View>

            <Animated.View
              style={[
                styles.vehicleBubble,
                {
                  transform: [
                    { translateX: vehicleTranslateX },
                    { translateY: vehicleTranslateY },
                    { scale: glowAnim },
                  ],
                },
              ]}
            >
              <MaterialCommunityIcons
                name={vehicleIcon as any}
                size={34}
                color="#111827"
              />
            </Animated.View>
          </View>

          <View style={styles.vehicleInfoCard}>
            <Text style={styles.vehicleInfoLabel}>Requested Vehicle</Text>
            <Text style={styles.vehicleInfoValue}>{vehicleLabel}</Text>
            <Text style={styles.vehicleInfoMeta}>
              {getVehicleStatusText(selectedVehicle)}
            </Text>
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
              <Text style={styles.summaryValue}>
                KES {estimatedPrice || "0"}
              </Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="time-outline" size={18} color="#1d4ed8" />
            <Text style={styles.tipText}>
              We’re notifying nearby {vehicleLabel.toLowerCase()} drivers in
              real time. Once one accepts, you’ll move straight into trip
              tracking.
            </Text>
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
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#b91c1c"
                />
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
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  connectionText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 13,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  heroBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#64748b",
    marginTop: 8,
    lineHeight: 20,
    textAlign: "center",
  },
  roadWrap: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 18,
    position: "relative",
  },
  roadLine: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  roadDashRow: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roadDash: {
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
  },
  vehicleBubble: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  vehicleInfoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
  },
  vehicleInfoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  vehicleInfoValue: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  vehicleInfoMeta: {
    color: "#475569",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },
  summaryRow: {
    marginBottom: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 14,
  },
  tipText: {
    flex: 1,
    color: "#1e3a8a",
    lineHeight: 20,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff1f2",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
});
