import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapPressEvent, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { BookingSheet } from "../../../components/booking/BookingSheet";
import { BottomSheet } from "../../../components/ui/bottom-sheet";
import { StateMessage } from "../../../components/ui/state-message";
import { design } from "../../../constants/design";
import { useBookingFlow } from "../../../hooks/useBookingFlow";
import { useCustomerStore } from "../../../store/customer";
import { useTripStore } from "../../../store/trip";
import { AppLocation, DropoffPlace } from "../../../types";

const nairobi = { latitude: -1.286389, longitude: 36.817223, latitudeDelta: 0.06, longitudeDelta: 0.06 };

export default function HomeScreen() {
  const mapRef = useRef<MapView>(null);
  const flow = useBookingFlow();
  const { step, choosePickup, chooseDropoff, requestPayload } = flow;
  const [currentLocation, setCurrentLocation] = useState<AppLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [mapPicking, setMapPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeTrip = useCustomerStore((state) => state.activeTrip);
  const fetchActiveTrip = useCustomerStore((state) => state.fetchActiveTrip);

  useFocusEffect(useCallback(() => { fetchActiveTrip(); }, [fetchActiveTrip]));
  const moveTo = useCallback((point: AppLocation) => mapRef.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 450), []);

  const getCurrentLocation = useCallback(async (): Promise<AppLocation | null> => {
    setLoadingLocation(true); setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is off. Search or pin your location on the map instead.");
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(result.coords);
      const point = { latitude: result.coords.latitude, longitude: result.coords.longitude, address: [place?.name, place?.street, place?.district, place?.city].filter(Boolean).join(", ") || "Current location" };
      setCurrentLocation(point); moveTo(point);
      return point;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "We could not find your location.");
      return null;
    } finally { setLoadingLocation(false); }
  }, [moveTo]);

  useEffect(() => { void getCurrentLocation(); }, [getCurrentLocation]);
  const useCurrentLocation = useCallback(async () => {
    const point = await getCurrentLocation();
    if (!point) return;
    if (step === "dropoff") chooseDropoff(point);
    else choosePickup(point);
  }, [chooseDropoff, choosePickup, getCurrentLocation, step]);
  const chooseSearch = useCallback((place: DropoffPlace) => { const point = { ...place, placeId: place.id }; moveTo(point); if (step === "pickup") choosePickup(point); else chooseDropoff(point); }, [chooseDropoff, choosePickup, moveTo, step]);
  const mapPress = useCallback(async (event: MapPressEvent) => {
    if (!mapPicking) return;
    const point = { ...event.nativeEvent.coordinate, address: "Pinned location" };
    try { const [place] = await Location.reverseGeocodeAsync(point); point.address = [place?.name, place?.street, place?.district, place?.city].filter(Boolean).join(", ") || point.address; } catch { /* keep pin label */ }
    if (step === "pickup") choosePickup(point); else if (step === "dropoff") chooseDropoff(point);
    setMapPicking(false);
  }, [chooseDropoff, choosePickup, mapPicking, step]);
  const submit = useCallback(async () => {
    if (!requestPayload) {
      Alert.alert(
        "Choose a different drop-off",
        "Pickup and drop-off must be different locations before we can request a driver.",
      );
      return;
    }

    const createRequest = async () => {
      setSubmitting(true);
      useTripStore.getState().setCurrentRequest(requestPayload);
      const tripId = await useTripStore.getState().createTrip();
      setSubmitting(false);
      if (!tripId) return Alert.alert("Request failed", useTripStore.getState().error || "Please try again.");
      const createdTrip = useTripStore.getState().currentTrip;
      router.replace({ pathname: "/(customer)/searching", params: { tripId, pickup: createdTrip?.pickupAddress || requestPayload.pickupAddress, dropoff: createdTrip?.dropoffAddress || requestPayload.dropoffAddress, vehicleType: createdTrip?.vehicleType || requestPayload.vehicleType, loadSize: createdTrip?.loadSize || requestPayload.loadSize, estimatedPrice: String(createdTrip?.estimatedPrice ?? requestPayload.estimatedPrice), distanceKm: String(createdTrip?.distanceKm ?? requestPayload.distanceKm) } });
    };

    if (flow.distanceKm < 0.05) {
      Alert.alert(
        "Very short trip",
        "Pickup and drop-off are very close. Is this intentional?",
        [
          { text: "Edit locations", style: "cancel" },
          { text: "Continue", onPress: () => void createRequest() },
        ],
      );
      return;
    }

    await createRequest();
  }, [flow.distanceKm, requestPayload]);

  if (activeTrip) return <View style={styles.active}><Text style={styles.activeTitle}>You have an active delivery</Text><Text style={styles.activeText}>{activeTrip.pickupAddress} → {activeTrip.dropoffAddress}</Text><TouchableOpacity onPress={() => router.push({ pathname: "/(customer)/live-trip", params: { tripId: activeTrip.id } })} style={styles.activeButton}><Text style={styles.activeButtonText}>Track delivery</Text></TouchableOpacity></View>;
  return <View style={styles.screen}>
    <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 } : nairobi} showsUserLocation showsMyLocationButton onPress={mapPress}>
      {flow.pickup && <Marker coordinate={flow.pickup} pinColor={design.colors.success} title="Pickup" />}{flow.dropoff && <Marker coordinate={flow.dropoff} pinColor={design.colors.danger} title="Drop-off" />}{flow.pickup && flow.dropoff && <Polyline coordinates={[flow.pickup, flow.dropoff]} strokeColor={design.colors.brand} strokeWidth={4} />}
    </MapView>
    <View style={styles.topBar}><View style={styles.brand}><Text style={styles.brandText}>Safirisha</Text></View><TouchableOpacity style={styles.profile} onPress={() => router.push("/(customer)/(tabs)/account")}><Ionicons name="person-outline" size={21} color={design.colors.ink} /></TouchableOpacity></View>
    {mapPicking && <View style={styles.mapHint}><Text style={styles.mapHintText}>Tap the map to set your {flow.step} location</Text></View>}{error && <View style={styles.error}><StateMessage tone="error" title="Location unavailable" description={error} /><TouchableOpacity style={styles.manualLocation} onPress={() => { setError(null); flow.setStep(flow.step === "idle" ? "pickup" : flow.step); }}><Text style={styles.manualLocationText}>Choose a location manually</Text></TouchableOpacity></View>}
    <BottomSheet visible snapPoints={[30, 60, 90]} initialSnap={flow.step === "idle" ? 0 : 1}>
      <BookingSheet flow={flow} currentLocation={currentLocation} loadingLocation={loadingLocation} submitting={submitting} onCurrentLocation={useCurrentLocation} onMapPick={() => setMapPicking(true)} onSearch={chooseSearch} onSubmit={submit} />
    </BottomSheet>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, topBar: { position: "absolute", top: 56, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }, brand: { backgroundColor: design.colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: design.radius.pill, ...design.shadow }, brandText: { ...design.typography.heading, color: design.colors.brand }, profile: { width: 44, height: 44, borderRadius: 22, backgroundColor: design.colors.surface, alignItems: "center", justifyContent: "center", ...design.shadow }, mapHint: { position: "absolute", top: 116, alignSelf: "center", backgroundColor: design.colors.ink, padding: 10, borderRadius: 10 }, mapHintText: { color: design.colors.white, ...design.typography.caption }, error: { position: "absolute", top: 116, left: 16, right: 16 }, manualLocation: { backgroundColor: design.colors.surface, alignItems: "center", paddingVertical: 10, borderBottomLeftRadius: design.radius.md, borderBottomRightRadius: design.radius.md }, manualLocationText: { ...design.typography.label, color: design.colors.brand }, active: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: design.colors.subtle }, activeTitle: { ...design.typography.title, color: design.colors.ink }, activeText: { ...design.typography.body, color: design.colors.muted, marginTop: 8 }, activeButton: { backgroundColor: design.colors.brand, padding: 16, borderRadius: design.radius.md, marginTop: 20, alignItems: "center" }, activeButtonText: { color: design.colors.white, ...design.typography.label } });
