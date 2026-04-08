import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import {
  DriverLiveLocation,
  PaymentMethod,
  PaymentStatus,
  Trip,
  TripStatus,
} from "../../types/trip";

function formatTripStatus(status?: string) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ");
}

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

function getVehicleLabel(vehicle?: string | null) {
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

function canCustomerCancel(status?: string) {
  return (
    status === "SEARCHING" ||
    status === "ACCEPTED" ||
    status === "DRIVER_EN_ROUTE"
  );
}

function getCustomerStatusHint(
  status?: TripStatus,
  paymentMethod?: PaymentMethod | null,
  paymentStatus?: PaymentStatus | null,
) {
  switch (status) {
    case "SEARCHING":
      return "We are still looking for a driver for your request.";
    case "ACCEPTED":
      return "A driver has accepted your request and trip monitoring is now active.";
    case "DRIVER_EN_ROUTE":
      return "Your driver is on the way to the pickup point.";
    case "ARRIVED_PICKUP":
      return "The driver says they have arrived. Confirm pickup handover only after your goods have been given to the driver.";
    case "PICKUP_CONFIRMED":
      return "Pickup has been confirmed. Your goods are now on the move.";
    case "IN_TRANSIT":
      return "Your goods are currently in transit to the destination.";
    case "ARRIVED_DROPOFF":
      return "The driver says they have arrived at drop-off. Confirm delivery only after you receive the goods.";
    case "DELIVERY_CONFIRMED":
      return "Delivery has been confirmed. Choose how you want to pay to complete the trip.";
    case "PAYMENT_PENDING":
      if (paymentMethod === "CASH") {
        return "Please pay the driver in cash. The driver will confirm receipt after payment.";
      }
      if (paymentMethod === "MPESA" && paymentStatus === "PENDING") {
        return "Your M-Pesa payment is being processed.";
      }
      return "Payment is pending.";
    case "DELIVERED":
      return "This trip has been completed successfully.";
    case "CANCELLED":
      return "This trip has been cancelled.";
    default:
      return "Tracking your trip live.";
  }
}

function getStatusPillColors(status?: TripStatus) {
  switch (status) {
    case "DELIVERED":
      return { bg: "#dcfce7", text: "#166534" };
    case "CANCELLED":
      return { bg: "#fee2e2", text: "#b91c1c" };
    case "SEARCHING":
      return { bg: "#fef3c7", text: "#b45309" };
    case "PAYMENT_PENDING":
      return { bg: "#ede9fe", text: "#6d28d9" };
    case "DELIVERY_CONFIRMED":
      return { bg: "#dbeafe", text: "#1d4ed8" };
    default:
      return { bg: "#eef2ff", text: "#4338ca" };
  }
}

function getProgressStep(status?: TripStatus) {
  switch (status) {
    case "SEARCHING":
      return 1;
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
      return 2;
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF":
      return 3;
    case "DELIVERY_CONFIRMED":
    case "PAYMENT_PENDING":
      return 4;
    case "DELIVERED":
      return 5;
    case "CANCELLED":
      return 0;
    default:
      return 1;
  }
}

export default function LiveTripScreen() {
  const { tripId, driverName, driverPhone, plateNumber } =
    useLocalSearchParams<{
      tripId?: string;
      driverName?: string;
      driverPhone?: string;
      plateNumber?: string;
    }>();

  const mapRef = useRef<MapView | null>(null);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverLocation, setDriverLocation] =
    useState<DriverLiveLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [selectingPayment, setSelectingPayment] =
    useState<PaymentMethod | null>(null);
  const [initiatingMpesa, setInitiatingMpesa] = useState(false);

  const fallbackDriverName = trip?.assignedDriver?.user?.fullName || "Driver";
  const fallbackDriverPhone = trip?.assignedDriver?.user?.phone || "";
  const fallbackPlate = trip?.assignedDriver?.plateNumber || "-";
  const fallbackVehicleType = trip?.assignedDriver?.vehicleType || "";

  const displayDriverName = driverName || fallbackDriverName;
  const displayDriverPhone = driverPhone || fallbackDriverPhone;
  const displayPlateNumber = plateNumber || fallbackPlate;
  const displayVehicleType = getVehicleLabel(fallbackVehicleType);
  const displayVehicleIcon = getVehicleIcon(fallbackVehicleType);

  const currentStatus = (trip?.status || "SEARCHING") as TripStatus;
  const currentPaymentMethod = trip?.paymentMethod || null;
  const currentPaymentStatus = trip?.paymentStatus || "UNPAID";

  const currentStatusLabel = useMemo(
    () => formatTripStatus(trip?.status),
    [trip?.status],
  );

  const statusHint = useMemo(
    () =>
      getCustomerStatusHint(
        currentStatus,
        currentPaymentMethod,
        currentPaymentStatus,
      ),
    [currentStatus, currentPaymentMethod, currentPaymentStatus],
  );

  const statusPillColors = useMemo(
    () => getStatusPillColors(currentStatus),
    [currentStatus],
  );

  const progressStep = useMemo(
    () => getProgressStep(currentStatus),
    [currentStatus],
  );

  const fitMapToPoints = useCallback(
    (nextTrip?: Trip | null, nextDriver?: DriverLiveLocation | null) => {
      const tripData = nextTrip || trip;
      const driverData = nextDriver || driverLocation;

      if (!tripData || !mapRef.current) return;

      const coordinates = [
        {
          latitude: tripData.pickupLat,
          longitude: tripData.pickupLng,
        },
        {
          latitude: tripData.dropoffLat,
          longitude: tripData.dropoffLng,
        },
      ];

      if (
        driverData &&
        typeof driverData.lat === "number" &&
        typeof driverData.lng === "number"
      ) {
        coordinates.push({
          latitude: driverData.lat,
          longitude: driverData.lng,
        });
      }

      if (coordinates.length >= 2) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 120,
            right: 60,
            bottom: 320,
            left: 60,
          },
          animated: true,
        });
      }
    },
    [trip, driverLocation],
  );

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const socket = connectSocket();
    let isMounted = true;

    const onDriverLocation = (payload: {
      tripId?: string;
      driverId?: string;
      lat?: number;
      lng?: number;
      currentLat?: number | null;
      currentLng?: number | null;
      heading?: number | null;
      speed?: number | null;
      updatedAt?: string;
    }) => {
      if (payload.tripId && payload.tripId !== tripId) return;

      const lat =
        typeof payload.lat === "number"
          ? payload.lat
          : typeof payload.currentLat === "number"
            ? payload.currentLat
            : null;

      const lng =
        typeof payload.lng === "number"
          ? payload.lng
          : typeof payload.currentLng === "number"
            ? payload.currentLng
            : null;

      if (typeof lat !== "number" || typeof lng !== "number") return;

      const nextLocation: DriverLiveLocation = {
        lat,
        lng,
        heading:
          typeof payload.heading === "number" ? payload.heading : undefined,
        speed: typeof payload.speed === "number" ? payload.speed : undefined,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      };

      setDriverLocation(nextLocation);

      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        700,
      );
    };

    const onTripUpdated = (payload: { trip: Trip }) => {
      if (!payload?.trip || payload.trip.id !== tripId) return;

      setTrip(payload.trip);

      if (payload.trip.status === "CANCELLED") {
        Alert.alert("Trip cancelled", "This trip has been cancelled.", [
          {
            text: "OK",
            onPress: () => router.replace("/(customer)/(tabs)"),
          },
        ]);
      }

      if (payload.trip.status === "DELIVERED") {
        Alert.alert(
          "Trip completed",
          "Your delivery and payment have been completed successfully.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(customer)/(tabs)/activity"),
            },
          ],
        );
      }
    };

    const onTripStatusUpdated = (payload: {
      tripId: string;
      status: string;
      paymentMethod?: PaymentMethod | null;
      paymentStatus?: PaymentStatus | null;
    }) => {
      if (payload.tripId !== tripId) return;

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status as Trip["status"],
              paymentMethod:
                payload.paymentMethod !== undefined
                  ? payload.paymentMethod
                  : prev.paymentMethod,
              paymentStatus:
                payload.paymentStatus !== undefined
                  ? payload.paymentStatus
                  : prev.paymentStatus,
            }
          : prev,
      );
    };

    const loadTrip = async () => {
      try {
        setLoading(true);

        const data = await apiFetch(`/trips/${tripId}`);

        if (!isMounted) return;

        const fetchedTrip = data?.trip ?? null;
        setTrip(fetchedTrip);

        const assignedDriver = fetchedTrip?.assignedDriver;

        if (
          assignedDriver &&
          typeof assignedDriver.currentLat === "number" &&
          typeof assignedDriver.currentLng === "number"
        ) {
          const nextLocation: DriverLiveLocation = {
            lat: assignedDriver.currentLat,
            lng: assignedDriver.currentLng,
            heading: assignedDriver.currentHeading ?? undefined,
            speed: assignedDriver.currentSpeed ?? undefined,
            updatedAt:
              assignedDriver.lastLocationAt ?? new Date().toISOString(),
          };

          setDriverLocation(nextLocation);
          setTimeout(() => {
            fitMapToPoints(fetchedTrip, nextLocation);
          }, 300);
        } else {
          setTimeout(() => {
            fitMapToPoints(fetchedTrip, null);
          }, 300);
        }

        socket.on("driver_location_updated", onDriverLocation);
        socket.on("trip_updated", onTripUpdated);
        socket.on("trip_status_updated", onTripStatusUpdated);
        socket.emit("join_trip_room", tripId);
      } catch (error: any) {
        Alert.alert(
          "Live trip unavailable",
          error?.message || "Failed to load live trip details.",
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTrip();

    return () => {
      isMounted = false;
      socket.emit("leave_trip_room", tripId);
      socket.off("driver_location_updated", onDriverLocation);
      socket.off("trip_updated", onTripUpdated);
      socket.off("trip_status_updated", onTripStatusUpdated);
    };
  }, [tripId, fitMapToPoints]);

  const handleCancelTrip = async () => {
    if (!tripId) return;

    Alert.alert("Cancel trip", "Do you want to cancel this trip?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);
            await apiFetch(`/trips/${tripId}/cancel`, {
              method: "PATCH",
            });

            Alert.alert("Trip cancelled", "Your trip has been cancelled.", [
              {
                text: "OK",
                onPress: () => router.replace("/(customer)/(tabs)"),
              },
            ]);
          } catch (error: any) {
            Alert.alert(
              "Cancel failed",
              error?.message || "Could not cancel the trip.",
            );
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleConfirmPickup = async () => {
    if (!tripId) return;

    Alert.alert(
      "Confirm pickup",
      "Confirm only after the driver has received your goods at pickup.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Confirm pickup",
          onPress: async () => {
            try {
              setConfirmingPickup(true);

              const data = await apiFetch(`/trips/${tripId}/confirm-pickup`, {
                method: "PATCH",
              });

              setTrip(data?.trip || trip);
            } catch (error: any) {
              Alert.alert(
                "Confirmation failed",
                error?.message || "Could not confirm pickup.",
              );
            } finally {
              setConfirmingPickup(false);
            }
          },
        },
      ],
    );
  };

  const handleConfirmDelivery = async () => {
    if (!tripId) return;

    Alert.alert(
      "Confirm delivery",
      "Confirm only after you have received the goods at drop-off.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Confirm delivery",
          onPress: async () => {
            try {
              setConfirmingDelivery(true);

              const data = await apiFetch(`/trips/${tripId}/confirm-delivery`, {
                method: "PATCH",
              });

              setTrip(data?.trip || trip);
            } catch (error: any) {
              Alert.alert(
                "Confirmation failed",
                error?.message || "Could not confirm delivery.",
              );
            } finally {
              setConfirmingDelivery(false);
            }
          },
        },
      ],
    );
  };

  const selectCash = async () => {
    if (!tripId) return;

    try {
      setSelectingPayment("CASH");
      const data = await apiFetch(`/payments/trips/${tripId}/method`, {
        method: "PATCH",
        body: { paymentMethod: "CASH" },
      });

      setTrip(data?.trip || trip);
    } catch (error: any) {
      Alert.alert(
        "Payment method failed",
        error?.message || "Could not choose cash payment.",
      );
    } finally {
      setSelectingPayment(null);
    }
  };

  const initiateMpesa = async () => {
    if (!tripId) return;

    try {
      setInitiatingMpesa(true);
      const data = await apiFetch(`/payments/trips/${tripId}/mpesa/initiate`, {
        method: "POST",
      });

      setTrip(data?.trip || trip);

      if (data?.simulated) {
        Alert.alert(
          "M-Pesa demo success",
          "This completed using simulation mode. Replace it with Daraja callback flow in production.",
        );
      } else {
        Alert.alert(
          "M-Pesa started",
          "Check your phone and complete the STK push.",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "M-Pesa failed",
        error?.message || "Could not start M-Pesa payment.",
      );
    } finally {
      setInitiatingMpesa(false);
    }
  };

  const openDialer = async () => {
    if (!displayDriverPhone) {
      Alert.alert(
        "No phone number",
        "Driver phone number is not available yet.",
      );
      return;
    }

    const url = `tel:${displayDriverPhone}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          "Call unavailable",
          "Your device cannot place calls right now.",
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Call failed", "Unable to open the phone dialer.");
    }
  };

  if (!tripId) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Missing trip ID</Text>
        <Text style={styles.errorText}>
          We couldn’t open this live trip because the trip ID is missing.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading || !trip) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingTitle}>Loading live trip...</Text>
        <Text style={styles.loadingText}>
          Fetching driver updates and trip details.
        </Text>
      </SafeAreaView>
    );
  }

  const mapRegion = {
    latitude: driverLocation?.lat || trip.pickupLat,
    longitude: driverLocation?.lng || trip.pickupLng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const showPaymentOptions =
    currentStatus === "DELIVERY_CONFIRMED" && !currentPaymentMethod;

  const showPaymentPendingInfo = currentStatus === "PAYMENT_PENDING";

  const routeLineCoordinates = driverLocation
    ? [
        {
          latitude: driverLocation.lat,
          longitude: driverLocation.lng,
        },
        {
          latitude:
            currentStatus === "ACCEPTED" ||
            currentStatus === "DRIVER_EN_ROUTE" ||
            currentStatus === "ARRIVED_PICKUP"
              ? trip.pickupLat
              : trip.dropoffLat,
          longitude:
            currentStatus === "ACCEPTED" ||
            currentStatus === "DRIVER_EN_ROUTE" ||
            currentStatus === "ARRIVED_PICKUP"
              ? trip.pickupLng
              : trip.dropoffLng,
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{
            latitude: trip.pickupLat,
            longitude: trip.pickupLng,
          }}
          title="Pickup"
          description={trip.pickupAddress}
        >
          <View style={styles.pickupMarker}>
            <Ionicons name="arrow-up" size={16} color="#ffffff" />
          </View>
        </Marker>

        <Marker
          coordinate={{
            latitude: trip.dropoffLat,
            longitude: trip.dropoffLng,
          }}
          title="Drop-off"
          description={trip.dropoffAddress}
        >
          <View style={styles.dropoffMarker}>
            <Ionicons name="location" size={16} color="#ffffff" />
          </View>
        </Marker>

        {routeLineCoordinates.length === 2 ? (
          <Polyline
            coordinates={routeLineCoordinates}
            strokeWidth={4}
            strokeColor="#111827"
          />
        ) : null}

        {driverLocation ? (
          <Marker
            coordinate={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
            }}
            title="Driver"
            description={displayDriverName}
          >
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerPulse} />
              <View style={styles.driverMarker}>
                <MaterialCommunityIcons
                  name={displayVehicleIcon as any}
                  size={18}
                  color="#fff"
                />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlayContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topActionButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topActionButton}
            onPress={() => fitMapToPoints()}
          >
            <Ionicons name="locate-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSheet}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE TRIP</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={styles.sheetTitle}>Your trip is live</Text>
              <Text style={styles.sheetSubtitle}>
                Status: {currentStatusLabel}
              </Text>
              <Text style={styles.statusHint}>{statusHint}</Text>
            </View>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusPillColors.bg },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: statusPillColors.text },
                ]}
              >
                {currentStatusLabel}
              </Text>
            </View>
          </View>

          {currentStatus !== "CANCELLED" ? (
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.progressDot,
                      step <= progressStep
                        ? styles.progressDotActive
                        : styles.progressDotInactive,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Requested</Text>
                <Text style={styles.progressLabel}>Pickup</Text>
                <Text style={styles.progressLabel}>Transit</Text>
                <Text style={styles.progressLabel}>Payment</Text>
                <Text style={styles.progressLabel}>Done</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.driverCard}>
            <View style={styles.driverHeader}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name={displayVehicleIcon as any}
                  size={22}
                  color="#111827"
                />
              </View>

              <View style={styles.driverTextWrap}>
                <Text style={styles.driverName}>{displayDriverName}</Text>
                <Text style={styles.driverMeta}>
                  {displayVehicleType} • Plate: {displayPlateNumber}
                </Text>
              </View>

              <TouchableOpacity style={styles.callButton} onPress={openDialer}>
                <Ionicons name="call-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Trip Summary</Text>

            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>
                {trip.pickupAddress || "Pickup not available"}
              </Text>
            </View>

            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Drop-off</Text>
              <Text style={styles.routeValue}>
                {trip.dropoffAddress || "Drop-off not available"}
              </Text>
            </View>

            <View style={styles.routeMetaRow}>
              <View style={styles.routeMetaCard}>
                <Text style={styles.routeMetaLabel}>Price</Text>
                <Text style={styles.routeMetaValue}>
                  KES {Number(trip.estimatedPrice || 0).toLocaleString()}
                </Text>
              </View>

              <View style={styles.routeMetaCard}>
                <Text style={styles.routeMetaLabel}>Payment</Text>
                <Text style={styles.routeMetaValue}>
                  {currentPaymentMethod || "Not selected"}
                </Text>
              </View>
            </View>
          </View>

          {currentStatus === "ARRIVED_PICKUP" && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                confirmingPickup && styles.buttonDisabled,
              ]}
              onPress={handleConfirmPickup}
              disabled={confirmingPickup}
            >
              {confirmingPickup ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>
                    Confirm Pickup Handover
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {currentStatus === "ARRIVED_DROPOFF" && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                confirmingDelivery && styles.buttonDisabled,
              ]}
              onPress={handleConfirmDelivery}
              disabled={confirmingDelivery}
            >
              {confirmingDelivery ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>
                    Confirm Delivery Received
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showPaymentOptions && (
            <View style={styles.paymentCard}>
              <Text style={styles.paymentTitle}>Choose payment method</Text>

              <TouchableOpacity
                style={[
                  styles.paymentOptionButton,
                  selectingPayment === "CASH" && styles.buttonDisabled,
                ]}
                onPress={selectCash}
                disabled={selectingPayment !== null}
              >
                {selectingPayment === "CASH" ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={18} color="#111827" />
                    <Text style={styles.paymentOptionText}>Pay with Cash</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOptionPrimary,
                  initiatingMpesa && styles.buttonDisabled,
                ]}
                onPress={initiateMpesa}
                disabled={initiatingMpesa}
              >
                {initiatingMpesa ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.paymentOptionPrimaryText}>
                      Pay with M-Pesa
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {showPaymentPendingInfo && (
            <View style={styles.paymentPendingCard}>
              <Text style={styles.paymentPendingTitle}>Payment pending</Text>
              <Text style={styles.paymentPendingText}>
                Method: {currentPaymentMethod || "Not selected"}
              </Text>
              <Text style={styles.paymentPendingText}>
                Status: {currentPaymentStatus}
              </Text>
              {currentPaymentMethod === "CASH" ? (
                <Text style={styles.paymentPendingText}>
                  Please pay the driver in cash. The driver will confirm
                  receipt.
                </Text>
              ) : (
                <Text style={styles.paymentPendingText}>
                  Your M-Pesa payment is being processed or already initiated.
                </Text>
              )}
            </View>
          )}

          {canCustomerCancel(trip.status) && (
            <TouchableOpacity
              style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
              onPress={handleCancelTrip}
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
                  <Text style={styles.cancelButtonText}>Cancel Trip</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    paddingTop: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    paddingBottom: 20,
    maxHeight: "62%",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  livePillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  statusTextWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  sheetSubtitle: {
    marginTop: 5,
    color: "#64748b",
    fontWeight: "700",
  },
  statusHint: {
    marginTop: 8,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "600",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  progressDotActive: {
    backgroundColor: "#111827",
  },
  progressDotInactive: {
    backgroundColor: "#d1d5db",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  driverCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  driverTextWrap: {
    flex: 1,
  },
  driverName: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
  driverMeta: {
    color: "#64748b",
    marginTop: 4,
    fontWeight: "700",
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  routeCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
  },
  routeItem: {
    marginBottom: 10,
  },
  routeLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  routeValue: {
    color: "#111827",
    fontWeight: "800",
    lineHeight: 20,
  },
  routeMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  routeMetaCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  routeMetaLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  routeMetaValue: {
    color: "#111827",
    fontWeight: "800",
  },
  paymentCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  paymentTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 10,
  },
  paymentOptionButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  paymentOptionText: {
    color: "#111827",
    fontWeight: "800",
  },
  paymentOptionPrimary: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paymentOptionPrimaryText: {
    color: "#fff",
    fontWeight: "800",
  },
  paymentPendingCard: {
    backgroundColor: "#faf5ff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    marginBottom: 12,
  },
  paymentPendingTitle: {
    color: "#6d28d9",
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 16,
  },
  paymentPendingText: {
    color: "#5b21b6",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 19,
  },
  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  dropoffMarker: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  driverMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarkerPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.18)",
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  actionButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  cancelButton: {
    backgroundColor: "#fff1f2",
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelButtonText: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  centerScreen: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  loadingText: {
    marginTop: 6,
    color: "#64748b",
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  errorText: {
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
