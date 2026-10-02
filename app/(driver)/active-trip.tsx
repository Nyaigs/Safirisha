import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "../../components/ui/map-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { useLayout } from "../../constants/layout";
import { apiFetch } from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import { maps } from "../../lib/maps";
import { useTripStore } from "../../store/trip";
import {
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
import { isValidCoordinate, toNumber } from "../../utils/validators";

type TripWithAddresses = Trip & {
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  distanceKm?: number;
  estimatedPrice?: number;
  customerName?: string;
  customerPhone?: string;
  specialNotes?: string;
  loadDescription?: string;
  loadSize?: string;
};

function formatStatus(status?: string) {
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

function getStatusHint(
  status: TripStatus,
  paymentMethod?: PaymentMethod | null,
  paymentStatus?: PaymentStatus | null,
) {
  switch (status) {
    case "ACCEPTED": return "Start heading to the pickup location.";
    case "DRIVER_EN_ROUTE": return "You are on the way to pickup. Mark arrival once you reach the customer.";
    case "ARRIVED_PICKUP": return "You've arrived at pickup. Wait for the customer to confirm handover.";
    case "PICKUP_CONFIRMED": return "Customer confirmed handover. Start the trip to the drop-off point.";
    case "IN_TRANSIT": return "Goods are now in transit. Mark arrival when you reach the drop-off.";
    case "ARRIVED_DROPOFF": return "You've arrived at drop-off. Wait for the customer to confirm delivery received.";
    case "DELIVERY_CONFIRMED": return "Customer confirmed delivery. Waiting for payment method selection.";
    case "PAYMENT_PENDING":
      if (paymentMethod === "CASH") return "Customer should pay you in cash. Confirm once you have received the cash.";
      if (paymentMethod === "MPESA" && paymentStatus === "PENDING") return "Waiting for customer M-Pesa payment to complete.";
      return "Payment is pending.";
    case "DELIVERED": return "This trip has been completed successfully.";
    case "CANCELLED": return "This trip has been cancelled.";
    default: return "No action available right now.";
  }
}

function getStatusTone(status?: TripStatus) {
  switch (status) {
    case "DELIVERED": return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
    case "CANCELLED": return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" };
    case "PAYMENT_PENDING": return { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe" };
    default: return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
  }
}

function getProgressStep(status?: TripStatus) {
  switch (status) {
    case "ACCEPTED": return 1;
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP": return 2;
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF": return 3;
    case "DELIVERY_CONFIRMED":
    case "PAYMENT_PENDING": return 4;
    case "DELIVERED": return 5;
    case "CANCELLED": return 0;
    default: return 1;
  }
}

export default function ActiveTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const mapRef = useRef<MapView | null>(null);
  const hasClosedRef = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useLayout();

  const trip = useTripStore((s) => s.currentTrip) as TripWithAddresses | null;
  const driverLocation = useTripStore((s) => s.driverLocation);
  const isLoading = useTripStore((s) => s.isLoading);
  const isSubmitting = useTripStore((s) => s.isSubmitting);
  const tripError = useTripStore((s) => s.error);
  const fetchTrip = useTripStore((s) => s.fetchTrip);
  const updateTripStatusAction = useTripStore((s) => s.updateTripStatus);
  const confirmCashAction = useTripStore((s) => s.confirmCash);

  const pickupLat = toNumber((trip as any)?.pickupLat, NaN);
  const pickupLng = toNumber((trip as any)?.pickupLng, NaN);
  const dropoffLat = toNumber((trip as any)?.dropoffLat, NaN);
  const dropoffLng = toNumber((trip as any)?.dropoffLng, NaN);

  const fallbackLat = isValidCoordinate(pickupLat) ? pickupLat : -1.286389;
  const fallbackLng = isValidCoordinate(pickupLng) ? pickupLng : 36.817223;

  const currentStatus = (trip?.status ?? "ACCEPTED") as TripStatus;
  const currentPaymentMethod = trip?.paymentMethod || null;
  const currentPaymentStatus = trip?.paymentStatus || "UNPAID";
  const vehicleType = trip?.assignedDriver?.vehicleType || "";
  const vehicleIcon = getVehicleIcon(vehicleType);
  const vehicleLabel = getVehicleLabel(vehicleType);
  const statusTone = useMemo(() => getStatusTone(currentStatus), [currentStatus]);
  const progressStep = useMemo(() => getProgressStep(currentStatus), [currentStatus]);

  const closeFlow = useCallback((title: string, message: string) => {
    if (hasClosedRef.current) return;
    hasClosedRef.current = true;
    Alert.alert(title, message, [
      { text: "OK", onPress: () => router.replace("/(driver)") },
    ]);
  }, []);

  const fitMapToPoints = useCallback(
    (nextTrip?: TripWithAddresses | null, nextDriver?: DriverLiveLocation | null) => {
      const tripData = nextTrip || (useTripStore.getState().currentTrip as TripWithAddresses | null);
      const driverData = nextDriver || useTripStore.getState().driverLocation;
      if (!tripData || !mapRef.current) return;

      const points: { latitude: number; longitude: number }[] = [];
      const nextPickupLat = toNumber((tripData as any)?.pickupLat, NaN);
      const nextPickupLng = toNumber((tripData as any)?.pickupLng, NaN);
      const nextDropoffLat = toNumber((tripData as any)?.dropoffLat, NaN);
      const nextDropoffLng = toNumber((tripData as any)?.dropoffLng, NaN);

      if (isValidCoordinate(nextPickupLat) && isValidCoordinate(nextPickupLng)) {
        points.push({ latitude: nextPickupLat, longitude: nextPickupLng });
      }
      if (isValidCoordinate(nextDropoffLat) && isValidCoordinate(nextDropoffLng)) {
        points.push({ latitude: nextDropoffLat, longitude: nextDropoffLng });
      }
      if (driverData && isValidCoordinate(driverData.lat) && isValidCoordinate(driverData.lng)) {
        points.push({ latitude: driverData.lat, longitude: driverData.lng });
      }

      if (points.length >= 2) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 80, right: 60, bottom: 260, left: 60 },
          animated: true,
        });
        return;
      }
      if (points.length === 1) {
        mapRef.current.animateToRegion(
          { latitude: points[0].latitude, longitude: points[0].longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
          700,
        );
      }
    },
    [],
  );

  const initTrip = useCallback(async () => {
    if (!tripId) return null;
    const store = useTripStore;
    await store.getState().fetchTrip(tripId);
    const fetchedTrip = store.getState().currentTrip as TripWithAddresses | null;
    if (!fetchedTrip) throw new Error(store.getState().error || "Trip not found");

    const assignedDriver = fetchedTrip.assignedDriver;
    let initialDriverLocation: DriverLiveLocation | null = null;
    if (assignedDriver && isValidCoordinate(assignedDriver.currentLat) && isValidCoordinate(assignedDriver.currentLng)) {
      initialDriverLocation = {
        lat: assignedDriver.currentLat!,
        lng: assignedDriver.currentLng!,
        heading: assignedDriver.currentHeading ?? undefined,
        speed: assignedDriver.currentSpeed ?? undefined,
        updatedAt: assignedDriver.lastLocationAt ?? new Date().toISOString(),
      };
      store.getState().setDriverLocation(initialDriverLocation);
    }
    setTimeout(() => fitMapToPoints(fetchedTrip, initialDriverLocation), 300);
    return fetchedTrip;
  }, [fitMapToPoints, tripId]);

  useEffect(() => {
    if (!tripId) return;
    const store = useTripStore;
    const socket = connectSocket();
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) setSocketConnected(socket.connected); });
    let locationSub: Location.LocationSubscription | null = null;

    const reconcileAfterReconnect = () => {
      setSocketConnected(true);
      void initTrip();
      store.getState().subscribeToTripRoom(tripId);
    };
    const markDisconnected = () => setSocketConnected(false);

    const onTripUpdated = (payload: TripUpdatedPayload) => {
      if (!mounted || !payload?.trip || payload.trip.id !== tripId) return;
      const nextTrip = payload.trip as TripWithAddresses;
      store.getState().setCurrentTrip(nextTrip);
      setTimeout(() => fitMapToPoints(nextTrip, store.getState().driverLocation), 200);
      if (nextTrip.status === "DELIVERED") closeFlow("Trip complete", "Trip and payment completed successfully.");
      if (nextTrip.status === "CANCELLED") closeFlow("Trip cancelled", "This trip has been cancelled.");
    };

    const onTripStatusUpdated = (payload: TripStatusUpdatedPayload) => {
      if (!mounted || payload.tripId !== tripId) return;
      const prev = store.getState().currentTrip;
      if (prev) {
        store.getState().setCurrentTrip({
          ...prev,
          status: payload.status,
          paymentMethod: payload.paymentMethod !== undefined ? payload.paymentMethod : prev.paymentMethod,
          paymentStatus: payload.paymentStatus !== undefined ? payload.paymentStatus : prev.paymentStatus,
        } as Trip);
      }
    };

    const onTripExpired = (payload: TripExpiredPayload) => {
      if (!mounted || payload.tripId !== tripId) return;
      closeFlow("Trip unavailable", "This trip is no longer available.");
    };

    const onDriverLocationUpdated = (payload: DriverLocationUpdatedPayload) => {
      if (!mounted) return;
      if (payload.tripId && payload.tripId !== tripId) return;
      const lat = typeof payload.lat === "number" ? payload.lat : typeof payload.currentLat === "number" ? payload.currentLat : null;
      const lng = typeof payload.lng === "number" ? payload.lng : typeof payload.currentLng === "number" ? payload.currentLng : null;
      if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) return;
      const nextLocation: DriverLiveLocation = {
        lat, lng,
        heading: typeof payload.heading === "number" ? payload.heading : undefined,
        speed: typeof payload.speed === "number" ? payload.speed : undefined,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      };
      store.getState().setDriverLocation(nextLocation);
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 700);
    };

    const start = async () => {
      try {
        const fetchedTrip = await initTrip();
        if (!mounted || !fetchedTrip) return;
        if (fetchedTrip.status === "CANCELLED") {
          closeFlow("Trip closed", "This trip is no longer active.");
          return;
        }
        store.getState().subscribeToTripRoom(tripId);
        socket.on("connect", reconcileAfterReconnect);
        socket.on("disconnect", markDisconnected);
        socket.on("trip_updated", onTripUpdated);
        socket.on("trip_status_updated", onTripStatusUpdated);
        socket.on("trip_expired", onTripExpired);
        socket.on("driver_location_updated", onDriverLocationUpdated);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") throw new Error("Location permission denied");

        locationSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          async (loc) => {
            try {
              await apiFetch("/drivers/me/location", {
                method: "PATCH",
                body: {
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                  heading: loc.coords.heading ?? undefined,
                  speed: loc.coords.speed ?? undefined,
                },
              });
              if (!mounted) return;
              store.getState().setDriverLocation({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                heading: loc.coords.heading ?? undefined,
                speed: loc.coords.speed ?? undefined,
                updatedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.log("Failed to sync live driver location", error);
            }
          },
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error fetching trip.";
        Alert.alert("Failed to load trip", message);
      }
    };

    start();

    return () => {
      mounted = false;
      locationSub?.remove();
      store.getState().unsubscribeFromTripRoom(tripId);
      socket.off("connect", reconcileAfterReconnect);
      socket.off("disconnect", markDisconnected);
      socket.off("trip_updated", onTripUpdated);
      socket.off("trip_status_updated", onTripStatusUpdated);
      socket.off("trip_expired", onTripExpired);
      socket.off("driver_location_updated", onDriverLocationUpdated);
    };
  }, [tripId, initTrip, fitMapToPoints, closeFlow]);

  const updateStatus = async (status: TripStatus) => {
    if (!tripId) return;
    await updateTripStatusAction(tripId, status);
    if (useTripStore.getState().error) {
      Alert.alert("Update failed", useTripStore.getState().error || "Could not update trip status.");
    }
  };

  const confirmCashReceived = async () => {
    if (!tripId) return;
    await confirmCashAction(tripId);
    if (useTripStore.getState().error) {
      Alert.alert("Cash confirmation failed", useTripStore.getState().error || "Could not confirm cash payment.");
    }
  };

  const openDialer = async () => {
    const phone = trip?.customer?.phone || trip?.customerPhone || "";
    if (!phone) {
      Alert.alert("No phone number", "Customer phone number is not available.");
      return;
    }
    const url = `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Call unavailable", "Your device cannot place calls.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Call failed", "Unable to open the phone dialer.");
    }
  };

  const openNavigation = async () => {
    const headingToPickup =
      currentStatus === "ACCEPTED" ||
      currentStatus === "DRIVER_EN_ROUTE" ||
      currentStatus === "ARRIVED_PICKUP";
    const latitude = headingToPickup ? pickupLat : dropoffLat;
    const longitude = headingToPickup ? pickupLng : dropoffLng;
    if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
      Alert.alert("Navigation unavailable", "This trip does not have a valid destination yet.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Navigation unavailable", "No maps app is available on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Navigation unavailable", "Unable to open directions right now.");
    }
  };

  const actionConfig = useMemo(() => {
    switch (currentStatus) {
      case "ACCEPTED": return { label: "Start Heading to Pickup", type: "status" as const, nextStatus: "DRIVER_EN_ROUTE" as TripStatus };
      case "DRIVER_EN_ROUTE": return { label: "Mark Arrived at Pickup", type: "status" as const, nextStatus: "ARRIVED_PICKUP" as TripStatus };
      case "PICKUP_CONFIRMED": return { label: "Start Trip to Drop-off", type: "status" as const, nextStatus: "IN_TRANSIT" as TripStatus };
      case "IN_TRANSIT": return { label: "Mark Arrived at Drop-off", type: "status" as const, nextStatus: "ARRIVED_DROPOFF" as TripStatus };
      case "PAYMENT_PENDING":
        if (currentPaymentMethod === "CASH" && currentPaymentStatus !== "PAID") {
          return { label: "Confirm Cash Received", type: "cash" as const };
        }
        return null;
      default: return null;
    }
  }, [currentStatus, currentPaymentMethod, currentPaymentStatus]);

  const initialRegion = {
    latitude: driverLocation && isValidCoordinate(driverLocation.lat) ? driverLocation.lat : fallbackLat,
    longitude: driverLocation && isValidCoordinate(driverLocation.lng) ? driverLocation.lng : fallbackLng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  if (!tripId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.centerText}>No active trip selected.</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={design.colors.ink} />
        <Text style={styles.centerText}>Loading active trip...</Text>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.centerText}>{tripError || "Trip not found."}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void fetchTrip(tripId)}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const waitingAtPickup = currentStatus === "ARRIVED_PICKUP";
  const waitingAtDropoff = currentStatus === "ARRIVED_DROPOFF";

  useEffect(() => {
    if (!pickupLat || !dropoffLat) return;
    const isEnRoute = ["ACCEPTED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP"].includes(currentStatus);
    const origin = isEnRoute
      ? { lat: driverLocation?.lat ?? pickupLat, lng: driverLocation?.lng ?? pickupLng }
      : { lat: pickupLat, lng: pickupLng };
    const destination = isEnRoute
      ? { lat: pickupLat, lng: pickupLng }
      : { lat: dropoffLat, lng: dropoffLng };

    if (!Number.isFinite(origin.lat) || !Number.isFinite(destination.lat)) return;

    let cancelled = false;
    (async () => {
      try {
        const route = await maps.getRoute(origin, destination);
        const polyline = route?.polyline;
        if (!cancelled && polyline && polyline.length >= 2) {
          setRouteCoords(polyline);
        }
      } catch { /* fallback */ }
    })();
    return () => { cancelled = true; };
  }, [pickupLat, dropoffLat, currentStatus, driverLocation?.lat, driverLocation?.lng]);

  const routeLineCoordinates =
    driverLocation && isValidCoordinate(driverLocation.lat) && isValidCoordinate(driverLocation.lng)
      ? [
          { latitude: driverLocation.lat, longitude: driverLocation.lng },
          {
            latitude:
              currentStatus === "ACCEPTED" || currentStatus === "DRIVER_EN_ROUTE" || currentStatus === "ARRIVED_PICKUP"
                ? pickupLat
                : dropoffLat,
            longitude:
              currentStatus === "ACCEPTED" || currentStatus === "DRIVER_EN_ROUTE" || currentStatus === "ARRIVED_PICKUP"
                ? pickupLng
                : dropoffLng,
          },
        ].filter((point) => isValidCoordinate(point.latitude) && isValidCoordinate(point.longitude))
      : [];

  return (
    <View style={styles.screen}>
      <View style={[styles.mapWrap, { height: screenHeight * 0.42 }]}>
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
          {isValidCoordinate(pickupLat) && isValidCoordinate(pickupLng) ? (
            <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup" description={trip.pickupAddress}>
              <View style={styles.pickupMarker}>
                <Ionicons name="arrow-up" size={16} color={design.colors.white} />
              </View>
            </Marker>
          ) : null}
          {isValidCoordinate(dropoffLat) && isValidCoordinate(dropoffLng) ? (
            <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLng }} title="Drop-off" description={trip.dropoffAddress}>
              <View style={styles.dropoffMarker}>
                <Ionicons name="location" size={16} color={design.colors.white} />
              </View>
            </Marker>
          ) : null}
          {routeCoords.length >= 2 || routeLineCoordinates.length === 2 ? (
            <Polyline coordinates={routeCoords.length >= 2 ? routeCoords : routeLineCoordinates} strokeWidth={4} strokeColor={design.colors.ink} />
          ) : null}
          {driverLocation && isValidCoordinate(driverLocation.lat) && isValidCoordinate(driverLocation.lng) ? (
            <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="You">
              <View style={styles.driverMarkerWrap}>
                <View style={styles.driverMarkerPulse} />
                <View style={styles.driverMarker}>
                  <MaterialCommunityIcons name={vehicleIcon as any} size={18} color={design.colors.white} />
                </View>
              </View>
            </Marker>
          ) : null}
        </MapView>

        <View style={[styles.mapActions, { top: Math.max(insets.top, design.spacing.md) + design.spacing.xs }]}>
          <TouchableOpacity style={styles.mapActionButton} onPress={() => router.replace("/(driver)")}>
            <Ionicons name="arrow-back" size={20} color={design.colors.ink} />
          </TouchableOpacity>
          <View style={styles.mapActionsRight}>
            <TouchableOpacity style={styles.mapActionButton} onPress={openNavigation}>
              <Ionicons name="navigate-outline" size={20} color={design.colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapActionButton} onPress={() => fitMapToPoints()}>
              <Ionicons name="locate-outline" size={20} color={design.colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {!socketConnected ? (
          <View style={styles.reconnectBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color="#854d0e" />
            <Text style={styles.reconnectText}>Reconnecting… Trip updates may be delayed.</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={[styles.bottomSheetContent, { paddingBottom: insets.bottom + design.spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusCard, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
          <View style={styles.statusTopRow}>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: statusTone.text }]}>Current Status</Text>
              <Text style={styles.statusValue}>{formatStatus(currentStatus)}</Text>
              <Text style={styles.statusHint}>{getStatusHint(currentStatus, currentPaymentMethod, currentPaymentStatus)}</Text>
            </View>
            <View style={styles.vehicleBadge}>
              <MaterialCommunityIcons name={vehicleIcon as any} size={20} color={design.colors.ink} />
            </View>
          </View>

          {currentStatus !== "CANCELLED" ? (
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <View
                    key={step}
                    style={[styles.progressDot, step <= progressStep ? styles.progressDotActive : styles.progressDotInactive]}
                  />
                ))}
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Accepted</Text>
                <Text style={styles.progressLabel}>Pickup</Text>
                <Text style={styles.progressLabel}>Transit</Text>
                <Text style={styles.progressLabel}>Payment</Text>
                <Text style={styles.progressLabel}>Done</Text>
              </View>
            </View>
          ) : null}

          {actionConfig ? (
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting ? styles.buttonDisabled : null]}
              disabled={isSubmitting}
              onPress={() => {
                if (actionConfig.type === "status") updateStatus(actionConfig.nextStatus);
                else confirmCashReceived();
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={design.colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={design.colors.white} />
                  <Text style={styles.primaryButtonText}>{actionConfig.label}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBox}>
              <Text style={styles.completedText}>
                {waitingAtPickup
                  ? "Waiting for customer to confirm pickup handover."
                  : waitingAtDropoff
                    ? "Waiting for customer to confirm delivery received."
                    : currentStatus === "DELIVERY_CONFIRMED"
                      ? "Waiting for customer to choose payment method."
                      : currentStatus === "PAYMENT_PENDING" && currentPaymentMethod === "MPESA"
                        ? "Waiting for customer M-Pesa payment completion."
                        : currentStatus === "DELIVERED"
                          ? "This trip is complete."
                          : currentStatus === "CANCELLED"
                            ? "This trip was cancelled."
                            : "No further action needed right now."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.quickRow}>
          <View style={styles.quickInfoCard}>
            <Text style={styles.quickInfoLabel}>Vehicle</Text>
            <Text style={styles.quickInfoValue}>{vehicleLabel}</Text>
          </View>
          <TouchableOpacity style={styles.callButtonWide} onPress={openDialer}>
            <Ionicons name="call-outline" size={18} color={design.colors.white} />
            <Text style={styles.callButtonText}>Call Customer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Money</Text>
          <View style={styles.moneyGrid}>
            <View style={styles.moneyItem}>
              <Text style={styles.moneyLabel}>Fare</Text>
              <Text style={styles.moneyValue}>KES {Number(trip.estimatedPrice ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.moneyItem}>
              <Text style={styles.moneyLabel}>Your Net</Text>
              <Text style={styles.moneyValue}>KES {Number(trip.driverNetEarning ?? 0).toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            Safirisha Fee ({Number(trip.platformFeePercent ?? 0)}%): KES {Number(trip.platformFeeAmount ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.cardMeta}>Payment Method: {trip.paymentMethod || "Not selected"}</Text>
          <Text style={styles.cardMeta}>Payment Status: {trip.paymentStatus || "UNPAID"}</Text>
        </View>

        {(waitingAtPickup || waitingAtDropoff) && (
          <View style={styles.waitingCard}>
            <Ionicons name="time-outline" size={18} color={waitingAtPickup ? "#1d4ed8" : "#9333ea"} />
            <Text style={styles.waitingText}>
              {waitingAtPickup
                ? "Customer needs to confirm that goods were handed over before you can start the trip."
                : "Customer needs to confirm delivery receipt before payment can begin."}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Text style={styles.cardValue}>{trip.customer?.fullName || trip.customerName || "Customer"}</Text>
          <Text style={styles.cardMeta}>{trip.customer?.phone || trip.customerPhone || "No phone"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <Text style={styles.routeLabel}>Pickup</Text>
          <Text style={styles.cardValue}>{trip.pickupAddress || "Pickup not available"}</Text>
          <Text style={[styles.routeLabel, { marginTop: design.spacing.md }]}>Drop-off</Text>
          <Text style={styles.cardValue}>{trip.dropoffAddress || "Drop-off not available"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Load Details</Text>
          <Text style={styles.cardMeta}>Description: {trip.loadDescription || "Not provided"}</Text>
          <Text style={styles.cardMeta}>Size: {trip.loadSize || "Not set"}</Text>
          <Text style={styles.cardMeta}>Notes: {trip.specialNotes || "None"}</Text>
          <Text style={styles.cardMeta}>Price: KES {Number(trip.estimatedPrice ?? 0).toLocaleString()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: design.colors.surface },
  mapWrap: { position: "relative" },
  map: { flex: 1 },
  mapActions: {
    position: "absolute",
    left: design.spacing.md,
    right: design.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reconnectBanner: {
    position: "absolute",
    bottom: design.spacing.sm,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: "#fef3c7",
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
  },
  reconnectText: { color: "#854d0e", fontWeight: "700" },
  mapActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },
  mapActionsRight: { flexDirection: "row", gap: design.spacing.sm },
  bottomSheet: { flex: 1, backgroundColor: design.colors.surface },
  bottomSheetContent: { padding: design.spacing.md },
  statusCard: {
    borderRadius: design.radius.xl,
    padding: design.spacing.md,
    borderWidth: 1,
    marginBottom: design.spacing.md,
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: design.spacing.md,
  },
  statusInfo: { flex: 1 },
  vehicleBadge: {
    width: 46,
    height: 46,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: { fontSize: 12, fontWeight: "800", marginBottom: design.spacing.xs },
  statusValue: { color: design.colors.ink, fontSize: 22, fontWeight: "900", marginBottom: design.spacing.sm },
  statusHint: { color: design.colors.muted, lineHeight: 20, marginBottom: design.spacing.md, fontWeight: "600" },
  progressCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    padding: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: design.spacing.sm },
  progressDot: { width: 14, height: 14, borderRadius: 999 },
  progressDotActive: { backgroundColor: design.colors.ink },
  progressDotInactive: { backgroundColor: "#d1d5db" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: design.colors.muted, fontSize: 11, fontWeight: "700" },
  primaryButton: {
    backgroundColor: design.colors.ink,
    paddingVertical: design.spacing.md,
    borderRadius: design.radius.lg,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: design.spacing.sm,
  },
  primaryButtonText: { color: design.colors.white, fontWeight: "900", fontSize: 15 },
  completedBox: { backgroundColor: design.colors.surface, padding: design.spacing.md, borderRadius: design.radius.md },
  completedText: { color: design.colors.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  quickRow: { flexDirection: "row", gap: design.spacing.sm, marginBottom: design.spacing.md },
  quickInfoCard: {
    flex: 1,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickInfoLabel: { color: design.colors.muted, fontWeight: "800", fontSize: 12, marginBottom: design.spacing.xs },
  quickInfoValue: { color: design.colors.ink, fontWeight: "900", fontSize: 16 },
  callButtonWide: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: design.colors.ink,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    borderRadius: design.radius.md,
    gap: design.spacing.sm,
  },
  callButtonText: { color: design.colors.white, fontWeight: "800" },
  waitingCard: {
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  waitingText: { flex: 1, color: design.colors.muted, lineHeight: 20, fontWeight: "600" },
  card: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    padding: design.spacing.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  cardTitle: { color: design.colors.ink, fontWeight: "900", fontSize: 17, marginBottom: design.spacing.sm },
  cardValue: { color: design.colors.ink, fontWeight: "800", lineHeight: 21 },
  cardMeta: { color: design.colors.muted, marginTop: design.spacing.xs, lineHeight: 20 },
  moneyGrid: { flexDirection: "row", gap: design.spacing.sm, marginBottom: design.spacing.xs },
  moneyItem: {
    flex: 1,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.md,
    padding: design.spacing.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  moneyLabel: { color: design.colors.muted, fontSize: 12, fontWeight: "700", marginBottom: design.spacing.xs },
  moneyValue: { color: design.colors.ink, fontWeight: "900", fontSize: 15 },
  routeLabel: { color: design.colors.muted, fontWeight: "800", fontSize: 12, marginBottom: design.spacing.xs },
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
  buttonDisabled: { opacity: 0.7 },
  center: {
    flex: 1,
    backgroundColor: design.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: design.spacing.lg,
  },
  centerText: { marginTop: design.spacing.sm, color: design.colors.muted, fontWeight: "700", textAlign: "center" },
});