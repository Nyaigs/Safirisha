import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
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

function getVehicleIcon(vehicle?: string) {
  const normalized = String(vehicle || "").toLowerCase();
  if (normalized.includes("tuk")) return "rickshaw";
  if (normalized.includes("pickup")) return "truck-pickup";
  if (normalized.includes("lorry")) return "truck";
  if (normalized.includes("truck")) return "truck";
  if (normalized.includes("bike")) return "motorbike";
  return "truck-fast";
}

function getVehicleLabel(vehicle?: string) {
  const normalized = String(vehicle || "").toLowerCase();
  if (normalized.includes("tuk")) return "Tuk Tuk";
  if (normalized.includes("pickup")) return "Pickup";
  if (normalized.includes("lorry")) return "Lorry";
  if (normalized.includes("truck")) return "Truck";
  if (normalized.includes("bike")) return "Bike";
  return vehicle || "Transport Vehicle";
}

function getVehicleStatusText(vehicle?: string) {
  const normalized = String(vehicle || "").toLowerCase();

  if (normalized.includes("tuk")) {
    return "Looking for the nearest available tuk tuk transporter.";
  }

  if (normalized.includes("pickup")) {
    return "Matching your load with a nearby pickup transporter.";
  }

  if (normalized.includes("lorry")) {
    return "Searching for a lorry that fits your transport request.";
  }

  if (normalized.includes("bike")) {
    return "Checking for a nearby bike transporter.";
  }

  return "Matching your request with nearby transporters.";
}

export default function RequestScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [createdTripId, setCreatedTripId] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const {
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
  } = useLocalSearchParams<{
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

  const hasNavigatedRef = useRef(false);
  const moveAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;

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
          tripId: payload.tripId || createdTripId,
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
    [createdTripId],
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

  const handleRequestDriver = async () => {
    if (
      !pickup ||
      !dropoff ||
      !pickupLat ||
      !pickupLng ||
      !dropoffLat ||
      !dropoffLng ||
      !vehicleType ||
      !loadSize ||
      !estimatedPrice ||
      !distanceKm
    ) {
      Alert.alert(
        "Missing trip details",
        "Some trip details are missing. Please go back and try again.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiFetch("/trips", {
        method: "POST",
        body: {
          pickupAddress: pickup,
          pickupLat: Number(pickupLat),
          pickupLng: Number(pickupLng),
          dropoffAddress: dropoff,
          dropoffLat: Number(dropoffLat),
          dropoffLng: Number(dropoffLng),
          vehicleType,
          loadDescription: loadDescription || "",
          loadSize,
          specialNotes: specialNotes || "",
          estimatedPrice: Number(estimatedPrice),
          distanceKm: Number(distanceKm),
        },
      });

      setCreatedTripId(String(data?.trip?.id || ""));
      setMatching(true);
      setStatusText(getVehicleStatusText(vehicle || vehicleType));
    } catch (error: any) {
      console.error("Create trip error:", error);
      Alert.alert(
        "Request failed",
        error?.message || "Failed to create trip. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = useCallback(async () => {
    if (!createdTripId) {
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
              await apiFetch(`/trips/${createdTripId}/cancel`, {
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
  }, [createdTripId, goHomeAfterCancel]);

  useEffect(() => {
    if (!matching) return;

    const driveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(moveAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(moveAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.08,
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

    driveLoop.start();
    glowLoop.start();

    return () => {
      driveLoop.stop();
      glowLoop.stop();
    };
  }, [matching, moveAnim, glowAnim]);

  useEffect(() => {
    if (!matching) return;

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
  }, [matching]);

  useEffect(() => {
    if (!matching) return;

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
  }, [matching, phaseIndex, socketConnected]);

  useEffect(() => {
    if (!matching || !createdTripId) return;

    const socket = connectSocket();

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_trip_room", createdTripId);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setStatusText("Connection lost. Reconnecting to live updates...");
    };

    const onTripAccepted = (payload: AcceptedPayload) => {
      if (!payload?.tripId || payload.tripId !== createdTripId) return;
      goToDriverFound(payload);
    };

    const onTripStatusUpdated = (payload: {
      tripId: string;
      status: string;
    }) => {
      if (payload.tripId !== createdTripId) return;

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
      socket.emit("leave_trip_room", createdTripId);
    };
  }, [matching, createdTripId, goHomeAfterCancel, goToDriverFound]);

  useEffect(() => {
    if (!matching || !createdTripId) return;

    let active = true;

    const pollTrip = async () => {
      try {
        const data = await apiFetch(`/trips/${createdTripId}`);
        const trip = data?.trip;

        if (!active || !trip) return;

        if (trip.status === "CANCELLED") {
          goHomeAfterCancel();
          return;
        }

        if (trip.status === "ACCEPTED" && trip.assignedDriver) {
          goToDriverFound({
            tripId: trip.id || createdTripId,
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
  }, [matching, createdTripId, goHomeAfterCancel, goToDriverFound]);

  const vehicleTranslateX = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-130, 130],
  });

  if (matching) {
    return (
      <SafeAreaView style={styles.matchScreen}>
        <View style={styles.matchContainer}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancelRequest}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#b91c1c" />
              ) : (
                <Ionicons name="close" size={22} color="#111827" />
              )}
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
              <View style={styles.matchBadge}>
                <MaterialCommunityIcons
                  name={vehicleIcon as any}
                  size={22}
                  color="#fff"
                />
              </View>

              <Text style={styles.matchTitle}>Finding your driver</Text>
              <Text style={styles.matchSubtitle}>{statusText}</Text>
            </View>

            <View style={styles.roadWrap}>
              <View style={styles.roadLine} />
              <Animated.View
                style={[
                  styles.vehicleBubble,
                  {
                    transform: [
                      { translateX: vehicleTranslateX },
                      { scale: glowAnim },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={vehicleIcon as any}
                  size={28}
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
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#1d4ed8"
              />
              <Text style={styles.tipText}>
                We’re notifying nearby {vehicleLabel.toLowerCase()} drivers in
                real time. Once one accepts, you’ll move straight into live trip
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

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={submitting}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Review Request</Text>
            <Text style={styles.subtitle}>
              Confirm your trip details before we start searching
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={18}
              color="#1d4ed8"
            />
            <Text style={styles.statusText}>Ready to Submit</Text>
          </View>

          <Text style={styles.statusSubtext}>
            Once you confirm, Safirisha will begin matching your request with an
            available transporter.
          </Text>
        </View>

        <View style={styles.requestIdCard}>
          <Text style={styles.requestIdLabel}>Request ID</Text>
          <Text style={styles.requestIdValue}>{requestId || "SFR-00000"}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Route</Text>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.value}>{pickup || "Not set"}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Drop-off</Text>
            <Text style={styles.value}>{dropoff || "Not set"}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.value}>{distanceKm || "0"} km</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Load Details</Text>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>
              {loadDescription || "Not provided"}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Load Size</Text>
            <Text style={styles.value}>{loadSize || "Not selected"}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.label}>Special Notes</Text>
            <Text style={styles.value}>{specialNotes || "None"}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <Text style={styles.vehicleValue}>
            {getVehicleLabel(vehicle || vehicleType)}
          </Text>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <MaterialCommunityIcons
              name="cash-multiple"
              size={20}
              color="#047857"
            />
            <Text style={styles.priceLabel}>Estimated Price</Text>
          </View>

          <Text style={styles.priceValue}>KES {estimatedPrice || "0"}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.requestButton,
            submitting && styles.requestButtonDisabled,
          ]}
          onPress={handleRequestDriver}
          disabled={submitting}
        >
          <View style={styles.buttonContent}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={vehicleIcon as any}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.requestButtonText}>Find Driver</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>Edit Request</Text>
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
  },
  statusCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  statusSubtext: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  requestIdCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  requestIdLabel: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 6,
  },
  requestIdValue: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  detailItem: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 21,
    fontWeight: "500",
  },
  vehicleValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  priceCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    padding: 16,
    marginBottom: 16,
  },
  priceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  priceLabel: {
    marginLeft: 8,
    fontSize: 13,
    color: "#065f46",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priceValue: {
    fontSize: 28,
    color: "#047857",
    fontWeight: "800",
  },
  requestButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  requestButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  matchScreen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  matchContainer: {
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
  matchBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  matchTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  matchSubtitle: {
    color: "#64748b",
    marginTop: 8,
    lineHeight: 20,
    textAlign: "center",
  },
  roadWrap: {
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 18,
  },
  roadLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  vehicleBubble: {
    width: 76,
    height: 76,
    borderRadius: 24,
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
