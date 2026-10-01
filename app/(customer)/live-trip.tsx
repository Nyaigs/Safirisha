import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "../../components/ui/map-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ListSkeleton } from "../../components/ui/skeleton";
import { design } from "../../constants/design";
import { useLayout } from "../../constants/layout";
import { connectSocket, joinTripRoom, leaveTripRoom } from "../../lib/socket";
import { useTripStore } from "../../store/trip";
import type {
  DriverLiveLocation,
  DriverLocationUpdatedPayload,
  PaymentMethod,
  PaymentStatus,
  Trip,
  TripExpiredPayload,
  TripStatus,
  TripStatusUpdatedPayload,
  TripUpdatedPayload,
} from "../../types/trip";

function formatTripStatus(status?: string) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ");
}

function normalizeVehicle(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getVehicleIcon(vehicle?: string | null) {
  const normalized = normalizeVehicle(vehicle);
  if (normalized.includes("tuk") || normalized.includes("rickshaw")) return "rickshaw-electric";
  if (normalized.includes("pickup")) return "truck-cargo-container";
  if (normalized.includes("lorry")) return "truck";
  if (normalized.includes("truck")) return "truck-fast";
  if (normalized.includes("bike") || normalized.includes("boda") || normalized.includes("motor")) return "motorbike";
  return "truck-fast";
}

function getVehicleLabel(vehicle?: string | null) {
  const normalized = normalizeVehicle(vehicle);
  if (normalized.includes("tuk") || normalized.includes("rickshaw")) return "Tuk Tuk";
  if (normalized.includes("pickup")) return "Pickup";
  if (normalized.includes("lorry")) return "Lorry";
  if (normalized.includes("truck")) return "Truck";
  if (normalized.includes("bike") || normalized.includes("boda") || normalized.includes("motor")) return "Motorbike";
  return "Transport Vehicle";
}

function canCustomerCancel(status?: string) {
  return status === "SEARCHING" || status === "ACCEPTED" || status === "DRIVER_EN_ROUTE";
}

function getCustomerStatusHint(
  status?: TripStatus,
  paymentMethod?: PaymentMethod | null,
  paymentStatus?: PaymentStatus | null,
) {
  switch (status) {
    case "SEARCHING": return "We are still looking for a driver for your request.";
    case "ACCEPTED": return "A driver has accepted your request and trip monitoring is now active.";
    case "DRIVER_EN_ROUTE": return "Your driver is on the way to the pickup point.";
    case "ARRIVED_PICKUP": return "The driver says they have arrived. Confirm pickup handover only after your goods have been given to the driver.";
    case "PICKUP_CONFIRMED": return "Pickup has been confirmed. Your goods are now on the move.";
    case "IN_TRANSIT": return "Your goods are currently in transit to the destination.";
    case "ARRIVED_DROPOFF": return "The driver says they have arrived at drop-off. Confirm delivery only after you receive the goods.";
    case "DELIVERY_CONFIRMED": return "Delivery has been confirmed. Choose how you want to pay to complete the trip.";
    case "PAYMENT_PENDING":
      if (paymentMethod === "CASH") return "Please pay the driver in cash. The driver will confirm receipt after payment.";
      if (paymentMethod === "MPESA" && paymentStatus === "PENDING") return "Your M-Pesa payment is being processed.";
      return "Payment is pending.";
    case "DELIVERED": return "This trip has been completed successfully.";
    case "CANCELLED": return "This trip has been cancelled.";
    default: return "Tracking your trip live.";
  }
}

function getStatusPillColors(status?: TripStatus) {
  switch (status) {
    case "DELIVERED": return { bg: "#dcfce7", text: "#166534" };
    case "CANCELLED": return { bg: "#fee2e2", text: "#b91c1c" };
    case "SEARCHING": return { bg: "#fef3c7", text: "#b45309" };
    case "PAYMENT_PENDING": return { bg: "#ede9fe", text: "#6d28d9" };
    case "DELIVERY_CONFIRMED": return { bg: "#dbeafe", text: "#1d4ed8" };
    default: return { bg: "#eef2ff", text: "#4338ca" };
  }
}

function getProgressStep(status?: TripStatus) {
  switch (status) {
    case "SEARCHING":
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
      return 1;
    case "ARRIVED_PICKUP":
      return 2;
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
      return 3;
    case "ARRIVED_DROPOFF":
    case "DELIVERY_CONFIRMED":
    case "PAYMENT_PENDING":
    case "DELIVERED":
      return 4;
    case "CANCELLED":
      return 0;
    default:
      return 1;
  }
}

export default function LiveTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const safeTripId = useMemo(() => String(tripId || ""), [tripId]);

  const { height: screenHeight } = useLayout();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView | null>(null);
  const hasClosedRef = useRef(false);
  const tripFetchedRef = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const trip = useTripStore((s) => s.currentTrip);
  const driverLocation = useTripStore((s) => s.driverLocation);
  const isLoading = useTripStore((s) => s.isLoading);
  const isSubmitting = useTripStore((s) => s.isSubmitting);
  const tripError = useTripStore((s) => s.error);
  const fetchTrip = useTripStore((s) => s.fetchTrip);
  const cancelTrip = useTripStore((s) => s.cancelTrip);
  const confirmPickupAction = useTripStore((s) => s.confirmPickup);
  const confirmDeliveryAction = useTripStore((s) => s.confirmDelivery);
  const selectPaymentMethod = useTripStore((s) => s.selectPaymentMethod);
  const initiateMpesaAction = useTripStore((s) => s.initiateMpesa);

  const displayDriverName = trip?.assignedDriver?.user?.fullName || "Driver";
  const displayDriverPhone = trip?.assignedDriver?.user?.phone || "";
  const displayPlateNumber = trip?.assignedDriver?.plateNumber || "-";
  const displayVehicleType = getVehicleLabel(trip?.assignedDriver?.vehicleType);
  const displayVehicleIcon = getVehicleIcon(trip?.assignedDriver?.vehicleType);

  const currentStatus = (trip?.status || "SEARCHING") as TripStatus;
  const currentPaymentMethod = trip?.paymentMethod || null;
  const currentPaymentStatus = trip?.paymentStatus || "UNPAID";

  const currentStatusLabel = useMemo(() => formatTripStatus(trip?.status), [trip?.status]);
  const statusHint = useMemo(
    () => getCustomerStatusHint(currentStatus, currentPaymentMethod, currentPaymentStatus),
    [currentStatus, currentPaymentMethod, currentPaymentStatus],
  );
  const statusPillColors = useMemo(() => getStatusPillColors(currentStatus), [currentStatus]);
  const progressStep = useMemo(() => getProgressStep(currentStatus), [currentStatus]);

  const closeFlow = useCallback(
    (title: string, message: string, route: string, completedTripId?: string) => {
      if (hasClosedRef.current) return;
      hasClosedRef.current = true;
      Alert.alert(title, message, [
        {
          text: "OK",
          onPress: () =>
            completedTripId
              ? router.replace({ pathname: "/(customer)/rate-trip", params: { tripId: completedTripId } })
              : router.replace(route as any),
        },
      ]);
    },
    [],
  );

  const fitMapToPoints = useCallback(() => {
    const currentTrip = useTripStore.getState().currentTrip;
    const currentDriver = useTripStore.getState().driverLocation;
    if (!currentTrip || !mapRef.current) return;

    const coordinates = [
      { latitude: currentTrip.pickupLat, longitude: currentTrip.pickupLng },
      { latitude: currentTrip.dropoffLat, longitude: currentTrip.dropoffLng },
    ];

    if (currentDriver && typeof currentDriver.lat === "number" && typeof currentDriver.lng === "number") {
      coordinates.push({ latitude: currentDriver.lat, longitude: currentDriver.lng });
    }

    if (coordinates.length >= 2) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!safeTripId || tripFetchedRef.current) return;
    tripFetchedRef.current = true;

    const store = useTripStore;
    let isMounted = true;
    let fitTimeout: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      await store.getState().fetchTrip(safeTripId);
      if (!isMounted) return;

      const fetchedTrip = store.getState().currentTrip;
      if (!fetchedTrip) {
        Alert.alert(
          "Live trip unavailable",
          store.getState().error || "Failed to load live trip details.",
        );
        return;
      }

      if (fetchedTrip.status === "CANCELLED") {
        closeFlow(
          fetchedTrip.expiredAt ? "Search expired" : "Trip cancelled",
          fetchedTrip.expiredAt
            ? "No driver accepted this request in time."
            : "This trip has been cancelled.",
          "/(customer)/(tabs)",
        );
        return;
      }

      const assignedDriver = fetchedTrip.assignedDriver;
      if (
        assignedDriver &&
        typeof assignedDriver.currentLat === "number" &&
        typeof assignedDriver.currentLng === "number"
      ) {
        const loc: DriverLiveLocation = {
          lat: assignedDriver.currentLat,
          lng: assignedDriver.currentLng,
          heading: assignedDriver.currentHeading ?? undefined,
          speed: assignedDriver.currentSpeed ?? undefined,
          updatedAt: assignedDriver.lastLocationAt ?? new Date().toISOString(),
        };
        store.getState().setDriverLocation(loc);
      }

      fitTimeout = setTimeout(fitMapToPoints, 300);
    };

    init();
    return () => {
      isMounted = false;
      if (fitTimeout !== null) clearTimeout(fitTimeout);
    };
  }, [safeTripId, closeFlow, fitMapToPoints]);

  useEffect(() => {
    if (!safeTripId) return;
    let isMounted = true;

    const socket = connectSocket();
    joinTripRoom(safeTripId);

    const reconcileAfterReconnect = () => {
      void useTripStore.getState().fetchTrip(safeTripId);
      joinTripRoom(safeTripId);
      setSocketConnected(true);
    };

    const markDisconnected = () => setSocketConnected(false);

    const onDriverLocation = (payload: DriverLocationUpdatedPayload) => {
      if (!isMounted) return;
      if (payload.tripId && payload.tripId !== safeTripId) return;

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
        heading: typeof payload.heading === "number" ? payload.heading : undefined,
        speed: typeof payload.speed === "number" ? payload.speed : undefined,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      };

      useTripStore.getState().setDriverLocation(nextLocation);
    };

    const onTripUpdated = (payload: TripUpdatedPayload) => {
      if (!isMounted || !payload?.trip || payload.trip.id !== safeTripId) return;
      useTripStore.getState().setCurrentTrip(payload.trip);

      if (payload.trip.status === "CANCELLED") {
        closeFlow(
          payload.trip.expiredAt ? "Search expired" : "Trip cancelled",
          payload.trip.expiredAt
            ? "No driver accepted this request in time."
            : "This trip has been cancelled.",
          "/(customer)/(tabs)",
        );
      }
      if (payload.trip.status === "DELIVERED") {
        closeFlow(
          "Trip completed",
          "Your delivery has been completed successfully.",
          "/(customer)/(tabs)/activity",
          payload.trip.id,
        );
      }
    };

    const onTripStatusUpdated = (payload: TripStatusUpdatedPayload) => {
      if (!isMounted || payload.tripId !== safeTripId) return;
      const currentTrip = useTripStore.getState().currentTrip;
      if (currentTrip) {
        useTripStore.getState().setCurrentTrip({
          ...currentTrip,
          status: payload.status as Trip["status"],
          paymentMethod:
            payload.paymentMethod !== undefined ? payload.paymentMethod : currentTrip.paymentMethod,
          paymentStatus:
            payload.paymentStatus !== undefined ? payload.paymentStatus : currentTrip.paymentStatus,
        } as Trip);
      }
    };

    const onTripExpired = (payload: TripExpiredPayload) => {
      if (!isMounted || payload.tripId !== safeTripId) return;
      closeFlow("Search expired", "No driver accepted this request in time.", "/(customer)/(tabs)");
    };

    socket.on("driver_location_updated", onDriverLocation);
    socket.on("connect", reconcileAfterReconnect);
    socket.on("disconnect", markDisconnected);
    socket.on("trip_updated", onTripUpdated);
    socket.on("trip_status_updated", onTripStatusUpdated);
    socket.on("trip_expired", onTripExpired);

    void Promise.resolve().then(() => {
      if (isMounted && socket.connected) setSocketConnected(true);
    });

    return () => {
      isMounted = false;
      socket.off("driver_location_updated", onDriverLocation);
      socket.off("connect", reconcileAfterReconnect);
      socket.off("disconnect", markDisconnected);
      socket.off("trip_updated", onTripUpdated);
      socket.off("trip_status_updated", onTripStatusUpdated);
      socket.off("trip_expired", onTripExpired);
      leaveTripRoom(safeTripId);
    };
  }, [safeTripId, closeFlow]);

  const handleCancelTrip = () => {
    if (!safeTripId) return;
    Alert.alert("Cancel trip", "Do you want to cancel this trip?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          await cancelTrip(safeTripId);
          if (!useTripStore.getState().error) {
            closeFlow("Trip cancelled", "Your trip has been cancelled.", "/(customer)/(tabs)");
          } else {
            Alert.alert("Cancel failed", useTripStore.getState().error || "Could not cancel the trip.");
          }
        },
      },
    ]);
  };

  const handleConfirmPickup = () => {
    if (!safeTripId) return;
    Alert.alert("Confirm pickup", "Confirm only after the driver has received your goods at pickup.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Confirm pickup",
        onPress: async () => {
          await confirmPickupAction(safeTripId);
          if (useTripStore.getState().error)
            Alert.alert("Confirmation failed", useTripStore.getState().error || "Could not confirm pickup.");
        },
      },
    ]);
  };

  const handleConfirmDelivery = () => {
    if (!safeTripId) return;
    Alert.alert("Confirm delivery", "Confirm only after you have received the goods at drop-off.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Confirm delivery",
        onPress: async () => {
          await confirmDeliveryAction(safeTripId);
          if (useTripStore.getState().error)
            Alert.alert(
              "Confirmation failed",
              useTripStore.getState().error || "Could not confirm delivery.",
            );
        },
      },
    ]);
  };

  const selectCash = async () => {
    if (!safeTripId) return;
    await selectPaymentMethod(safeTripId, "CASH");
    if (useTripStore.getState().error)
      Alert.alert("Payment method failed", useTripStore.getState().error || "Could not choose cash payment.");
  };

  const initiateMpesa = async () => {
    if (!safeTripId) return;
    await initiateMpesaAction(safeTripId);
    if (useTripStore.getState().error) {
      Alert.alert("M-Pesa failed", useTripStore.getState().error || "Could not start M-Pesa payment.");
      return;
    }
    Alert.alert(
      "M-Pesa test payment complete",
      "This environment is using the configured M-Pesa simulation. No phone PIN prompt was sent.",
    );
  };

  const openDialer = async () => {
    if (!displayDriverPhone) {
      Alert.alert("No phone number", "Driver phone number is not available yet.");
      return;
    }
    const url = `tel:${displayDriverPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Call unavailable", "Your device cannot place calls right now.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Call failed", "Unable to open the phone dialer.");
    }
  };

  const shareTrip = async () => {
    if (!trip) return;

    try {
      await Share.share({
        title: "Safirisha delivery",
        message: [
          "Safirisha delivery",
          `Pickup: ${trip.pickupAddress}`,
          `Drop-off: ${trip.dropoffAddress}`,
          `Driver: ${displayDriverName}`,
          `Vehicle: ${displayVehicleType}${displayPlateNumber !== "-" ? ` (${displayPlateNumber})` : ""}`,
        ].join("\n"),
      });
    } catch {
      Alert.alert("Share unavailable", "Unable to open sharing on this device right now.");
    }
  };

  if (!safeTripId) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Missing trip ID</Text>
        <Text style={styles.errorText}>
          We could not open this live trip because the trip ID is missing.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ScrollView
          style={{ alignSelf: "stretch" }}
          contentContainerStyle={{ padding: design.spacing.md }}
        >
          <ListSkeleton rows={4} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Live trip unavailable</Text>
        <Text style={styles.errorText}>
          {tripError || "We couldn't load this trip. Please try again."}
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void fetchTrip(safeTripId)}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const mapRegion = {
    latitude: driverLocation?.lat || trip.pickupLat,
    longitude: driverLocation?.lng || trip.pickupLng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const showPaymentOptions = currentStatus === "DELIVERY_CONFIRMED" && !currentPaymentMethod;
  const showPaymentPendingInfo = currentStatus === "PAYMENT_PENDING";

  const routeLineCoordinates = driverLocation
    ? [
        { latitude: driverLocation.lat, longitude: driverLocation.lng },
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
          coordinate={{ latitude: trip.pickupLat, longitude: trip.pickupLng }}
          title="Pickup"
          description={trip.pickupAddress}
        >
          <View style={styles.pickupMarker}>
            <Ionicons name="arrow-up" size={16} color={design.colors.white} />
          </View>
        </Marker>
        <Marker
          coordinate={{ latitude: trip.dropoffLat, longitude: trip.dropoffLng }}
          title="Drop-off"
          description={trip.dropoffAddress}
        >
          <View style={styles.dropoffMarker}>
            <Ionicons name="location" size={16} color={design.colors.white} />
          </View>
        </Marker>
        {routeLineCoordinates.length === 2 ? (
          <Polyline coordinates={routeLineCoordinates} strokeWidth={4} strokeColor={design.colors.ink} />
        ) : null}
        {driverLocation ? (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title="Driver"
            description={displayDriverName}
          >
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerPulse} />
              <View style={styles.driverMarker}>
                <MaterialCommunityIcons name={displayVehicleIcon as any} size={18} color={design.colors.white} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View pointerEvents="box-none" style={styles.overlayContainer}>
        <View style={[styles.topBar, { paddingTop: insets.top + design.spacing.sm }]}>
          <TouchableOpacity style={styles.topActionButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={design.colors.ink} />
          </TouchableOpacity>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.topActionButton}
              onPress={fitMapToPoints}
              accessibilityRole="button"
              accessibilityLabel="Center map on trip"
            >
              <Ionicons name="locate-outline" size={20} color={design.colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topActionButton}
              onPress={() => setSafetyOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open safety options"
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={design.colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {!socketConnected ? (
          <View style={styles.reconnectBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color="#854d0e" />
            <Text style={styles.reconnectText}>Reconnecting… Trip updates may be delayed.</Text>
          </View>
        ) : null}

        <ScrollView
          style={[styles.bottomSheet, { maxHeight: screenHeight * 0.62 }]}
          contentContainerStyle={[
            styles.bottomSheetContent,
            { paddingBottom: insets.bottom + design.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.livePill}>
            <View style={[styles.liveDot, !socketConnected && styles.liveDotOffline]} />
            <Text style={styles.livePillText}>
              {socketConnected ? "LIVE TRIP" : "RECONNECTING"}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusTextWrap}>
              <Text style={styles.sheetTitle}>Your trip is live</Text>
              <Text style={styles.sheetSubtitle}>Status: {currentStatusLabel}</Text>
              <Text style={styles.statusHint}>{statusHint}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusPillColors.bg }]}>
              <Text style={[styles.statusPillText, { color: statusPillColors.text }]}>
                {currentStatusLabel}
              </Text>
            </View>
          </View>

          {currentStatus !== "CANCELLED" ? (
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                {[1, 2, 3, 4].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.progressDot,
                      step <= progressStep ? styles.progressDotActive : styles.progressDotInactive,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Driver en route</Text>
                <Text style={styles.progressLabel}>Loading cargo</Text>
                <Text style={styles.progressLabel}>In transit</Text>
                <Text style={styles.progressLabel}>Offloading</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.driverCard}>
            <View style={styles.driverHeader}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name={displayVehicleIcon as any}
                  size={22}
                  color={design.colors.ink}
                />
              </View>
              <View style={styles.driverTextWrap}>
                <Text style={styles.driverName}>{displayDriverName}</Text>
                <Text style={styles.driverMeta}>
                  {displayVehicleType} • Plate: {displayPlateNumber}
                </Text>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={openDialer}>
                <Ionicons name="call-outline" size={18} color={design.colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.shareButton}
            accessibilityRole="button"
            accessibilityLabel="Share delivery details"
            onPress={shareTrip}
          >
            <Ionicons name="share-social-outline" size={18} color={design.colors.brand} />
            <Text style={styles.shareButtonText}>Share delivery details</Text>
          </TouchableOpacity>

          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Trip Summary</Text>
            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>{trip.pickupAddress || "Pickup not available"}</Text>
            </View>
            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Drop-off</Text>
              <Text style={styles.routeValue}>{trip.dropoffAddress || "Drop-off not available"}</Text>
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
                <Text style={styles.routeMetaValue}>{currentPaymentMethod || "Not selected"}</Text>
              </View>
            </View>
          </View>

          {currentStatus === "ARRIVED_PICKUP" && (
            <TouchableOpacity
              style={[styles.actionButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleConfirmPickup}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={design.colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={design.colors.white} />
                  <Text style={styles.actionButtonText}>Confirm Pickup Handover</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {currentStatus === "ARRIVED_DROPOFF" && (
            <TouchableOpacity
              style={[styles.actionButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleConfirmDelivery}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={design.colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle-outline" size={18} color={design.colors.white} />
                  <Text style={styles.actionButtonText}>Confirm Delivery Received</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showPaymentOptions && (
            <View style={styles.paymentCard}>
              <Text style={styles.paymentTitle}>Choose payment method</Text>
              <TouchableOpacity
                style={[styles.paymentOptionButton, isSubmitting && styles.buttonDisabled]}
                onPress={selectCash}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={design.colors.ink} />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={18} color={design.colors.ink} />
                    <Text style={styles.paymentOptionText}>Pay with Cash</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentOptionPrimary, isSubmitting && styles.buttonDisabled]}
                onPress={initiateMpesa}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={design.colors.white} />
                ) : (
                  <>
                    <Ionicons name="phone-portrait-outline" size={18} color={design.colors.white} />
                    <Text style={styles.paymentOptionPrimaryText}>Pay with M-Pesa</Text>
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
              <Text style={styles.paymentPendingText}>Status: {currentPaymentStatus}</Text>
            </View>
          )}

          {canCustomerCancel(trip.status) && (
            <TouchableOpacity
              style={[styles.cancelButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleCancelTrip}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#b91c1c" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
                  <Text style={styles.cancelButtonText}>Cancel Trip</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={safetyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSafetyOpen(false)}
      >
        <View style={styles.safetyBackdrop}>
          <View style={[styles.safetySheet, { paddingBottom: insets.bottom + design.spacing.lg }]}>
            <View style={styles.safetyHeader}>
              <Text style={styles.safetyTitle}>Safety</Text>
              <TouchableOpacity
                style={styles.safetyClose}
                onPress={() => setSafetyOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close safety options"
              >
                <Ionicons name="close" size={22} color={design.colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.safetyContent}>
              <TouchableOpacity
                style={styles.safetyAction}
                onPress={() =>
                  Alert.alert(
                    "Support contact unavailable",
                    "A support phone number has not been configured yet.",
                  )
                }
              >
                <Ionicons name="call-outline" size={20} color={design.colors.brand} />
                <Text style={styles.safetyActionText}>Call Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.safetyAction}
                onPress={() => {
                  setSafetyOpen(false);
                  void shareTrip();
                }}
              >
                <Ionicons name="share-social-outline" size={20} color={design.colors.brand} />
                <Text style={styles.safetyActionText}>Share Trip</Text>
              </TouchableOpacity>
              <View style={styles.identityCard}>
                <Text style={styles.identityHeading}>Driver identity</Text>
                <Text style={styles.identityText}>{displayDriverName}</Text>
                <Text style={styles.identityText}>
                  {displayVehicleType} · {displayPlateNumber}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: design.colors.surface },
  map: { flex: 1 },
  overlayContainer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between" },
  topBar: {
    paddingHorizontal: design.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topActions: { flexDirection: "row", gap: design.spacing.sm },
  reconnectBanner: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: "#fef3c7",
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    marginHorizontal: design.spacing.md,
    marginTop: design.spacing.sm,
  },
  reconnectText: { color: "#854d0e", fontWeight: "700" },
  topActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },
  bottomSheet: {
    backgroundColor: design.colors.surface,
    borderTopLeftRadius: design.radius.xl,
    borderTopRightRadius: design.radius.xl,
  },
  bottomSheetContent: {
    padding: design.spacing.md,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: design.colors.ink,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    borderRadius: design.radius.pill,
    marginBottom: design.spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: design.colors.success,
    marginRight: design.spacing.sm,
  },
  liveDotOffline: { backgroundColor: "#f59e0b" },
  livePillText: { color: design.colors.white, fontSize: 12, fontWeight: "800" },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: design.spacing.sm,
    alignItems: "flex-start",
    marginBottom: design.spacing.md,
  },
  statusTextWrap: { flex: 1 },
  sheetTitle: { ...design.typography.title, color: design.colors.ink },
  sheetSubtitle: {
    marginTop: design.spacing.xs,
    color: design.colors.muted,
    fontWeight: "700",
  },
  statusHint: {
    marginTop: design.spacing.sm,
    color: design.colors.muted,
    lineHeight: 20,
    fontWeight: "600",
  },
  statusPill: {
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.sm,
    alignSelf: "flex-start",
  },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  progressCard: {
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: design.spacing.sm,
  },
  progressDot: { width: 14, height: 14, borderRadius: 999 },
  progressDotActive: { backgroundColor: design.colors.ink },
  progressDotInactive: { backgroundColor: "#d1d5db" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: design.colors.muted, fontSize: 11, fontWeight: "700" },
  driverCard: {
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  driverHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: design.radius.md,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: design.spacing.md,
  },
  driverTextWrap: { flex: 1 },
  driverName: { color: design.colors.ink, fontWeight: "900", fontSize: 16 },
  driverMeta: {
    color: design.colors.muted,
    marginTop: design.spacing.xs,
    fontWeight: "700",
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  shareButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.brand,
    backgroundColor: "#E4F4EF",
    marginBottom: design.spacing.md,
  },
  shareButtonText: { color: design.colors.brand, fontWeight: "800" },
  routeCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: design.colors.ink,
    marginBottom: design.spacing.sm,
  },
  routeItem: { marginBottom: design.spacing.sm },
  routeLabel: {
    color: design.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: design.spacing.xs,
  },
  routeValue: { color: design.colors.ink, fontWeight: "800", lineHeight: 20 },
  routeMetaRow: { flexDirection: "row", gap: design.spacing.sm, marginTop: design.spacing.xs },
  routeMetaCard: {
    flex: 1,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.md,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  routeMetaLabel: {
    color: design.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: design.spacing.xs,
  },
  routeMetaValue: { color: design.colors.ink, fontWeight: "800" },
  paymentCard: {
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  paymentTitle: {
    color: design.colors.ink,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: design.spacing.sm,
  },
  paymentOptionButton: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.md,
    paddingVertical: design.spacing.md,
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
    marginBottom: design.spacing.sm,
  },
  paymentOptionText: { color: design.colors.ink, fontWeight: "800" },
  paymentOptionPrimary: {
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.md,
    paddingVertical: design.spacing.md,
    borderWidth: 1,
    borderColor: design.colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
  },
  paymentOptionPrimaryText: { color: design.colors.white, fontWeight: "800" },
  paymentPendingCard: {
    backgroundColor: "#faf5ff",
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    marginBottom: design.spacing.md,
  },
  paymentPendingTitle: {
    color: "#6d28d9",
    fontWeight: "900",
    marginBottom: design.spacing.sm,
    fontSize: 16,
  },
  paymentPendingText: {
    color: "#5b21b6",
    fontWeight: "700",
    marginTop: design.spacing.xs,
    lineHeight: 19,
  },
  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: design.colors.success,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: design.colors.white,
  },
  dropoffMarker: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: design.colors.danger,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: design.colors.white,
  },
  driverMarkerWrap: { alignItems: "center", justifyContent: "center" },
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
    backgroundColor: design.colors.ink,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: design.colors.white,
  },
  actionButton: {
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.md,
    paddingVertical: design.spacing.md,
    borderWidth: 1,
    borderColor: design.colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  actionButtonText: { color: design.colors.white, fontWeight: "800", fontSize: 15 },
  cancelButton: {
    backgroundColor: "#fff1f2",
    borderRadius: design.radius.md,
    paddingVertical: design.spacing.md,
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.sm,
  },
  cancelButtonText: { color: "#b91c1c", fontWeight: "800", fontSize: 15 },
  buttonDisabled: { opacity: 0.7 },
  safetyBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  safetySheet: {
    maxHeight: "80%",
    backgroundColor: design.colors.surface,
    borderTopLeftRadius: design.radius.xl,
    borderTopRightRadius: design.radius.xl,
    paddingHorizontal: design.spacing.lg,
    paddingTop: design.spacing.lg,
  },
  safetyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: design.spacing.md,
  },
  safetyTitle: { color: design.colors.ink, fontSize: 20, fontWeight: "900" },
  safetyClose: {
    width: 44,
    height: 44,
    borderRadius: design.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: design.colors.subtle,
  },
  safetyContent: { gap: design.spacing.sm, paddingBottom: design.spacing.sm },
  safetyAction: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.md,
    borderWidth: 1,
    borderColor: "#dde5e1",
    borderRadius: design.radius.md,
    paddingHorizontal: design.spacing.md,
  },
  safetyActionText: { color: "#12211e", fontWeight: "800", fontSize: 15 },
  identityCard: {
    backgroundColor: "#f4f7f5",
    borderRadius: design.radius.md,
    padding: design.spacing.md,
    gap: design.spacing.xs,
  },
  identityHeading: {
    color: "#68746f",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: design.spacing.xs,
  },
  identityText: { color: "#12211e", fontSize: 15, fontWeight: "700" },
  centerScreen: {
    flex: 1,
    backgroundColor: design.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    padding: design.spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: design.colors.ink,
    marginBottom: design.spacing.sm,
  },
  errorText: {
    color: design.colors.muted,
    textAlign: "center",
    marginBottom: design.spacing.md,
  },
  primaryButton: {
    backgroundColor: design.colors.ink,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.md,
  },
  primaryButtonText: { color: design.colors.white, fontWeight: "800" },
});