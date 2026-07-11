import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropoffSearch from "../../../components/dropoffsearch";
import LoadSizeSelector from "../../../components/loadsizeselector";
import VehicleCard from "../../../components/vehiclecard";
import { getLoadSizeByKey } from "../../../constants/loadsizes";
import { VEHICLES, VehicleItem } from "../../../constants/vehicles";
import { useCustomerStore } from "../../../store/customer";
import { useTripStore } from "../../../store/trip";
import { AppLocation, DropoffPlace, LoadSize, VehicleId } from "../../../types";
import { estimatePrice } from "../../../utils/pricing";

function getStatusColor(status?: string) {
  switch (status) {
    case "SEARCHING":
      return { bg: "#fef3c7", text: "#b45309" };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
      return { bg: "#dbeafe", text: "#1d4ed8" };
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF":
      return { bg: "#dcfce7", text: "#166534" };
    default:
      return { bg: "#f3f4f6", text: "#374151" };
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadSizeModalVisible, setLoadSizeModalVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [pickupLocation, setPickupLocation] = useState<AppLocation | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<AppLocation | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleId | null>(null);
  const [loadDescription, setLoadDescription] = useState("");
  const [loadSize, setLoadSize] = useState<LoadSize | null>(null);
  const [specialNotes, setSpecialNotes] = useState("");

  const activeTrip = useCustomerStore((s) => s.activeTrip);
  const recentTrips = useCustomerStore((s) => s.recentTrips);
  const loadingDashboard = useCustomerStore((s) => s.loadingActiveTrip);
  const refreshing = useCustomerStore((s) => s.loadingTrips);
  const fetchActiveTrip = useCustomerStore((s) => s.fetchActiveTrip);
  const fetchRecentTrips = useCustomerStore((s) => s.fetchRecentTrips);
  const setCurrentRequest = useTripStore((s) => s.setCurrentRequest);

  const getReadableAddress = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!results || results.length === 0) return "Current Location";

      const place = results[0];
      const parts = [place.name, place.street, place.city, place.region, place.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : "Current Location";
    } catch {
      return "Current Location";
    }
  };

  const getUserLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      setErrorMsg("");

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setErrorMsg("Location permission denied. Please enable location access.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const address = await getReadableAddress(location.coords.latitude, location.coords.longitude);

      setPickupLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude, address });
    } catch {
      setErrorMsg("Failed to fetch your current location.");
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  useFocusEffect(
    useCallback(() => {
      fetchActiveTrip();
      fetchRecentTrips();
    }, [fetchActiveTrip, fetchRecentTrips]),
  );

  const handleDropoffSelect = (place: DropoffPlace) => {
    setDropoffLocation({ latitude: place.latitude, longitude: place.longitude, address: place.address });
  };

  const distanceKm = useMemo(() => {
    if (!pickupLocation || !dropoffLocation) return 0;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(dropoffLocation.latitude - pickupLocation.latitude);
    const dLng = toRad(dropoffLocation.longitude - pickupLocation.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(pickupLocation.latitude)) * Math.cos(toRad(dropoffLocation.latitude)) * Math.sin(dLng / 2) ** 2;
    return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  }, [pickupLocation, dropoffLocation]);

  const isVehicleAllowedForLoadSize = (vehicleId: VehicleId, selectedLoadSize: LoadSize | null) => {
    if (!selectedLoadSize) return true;
    const vehicle = VEHICLES.find((item: VehicleItem) => item.id === vehicleId);
    return vehicle ? vehicle.supportedLoadSizes.includes(selectedLoadSize) : false;
  };

  useEffect(() => {
    if (!selectedVehicle || !loadSize) return;
    const vehicle = VEHICLES.find((item: VehicleItem) => item.id === selectedVehicle);
    if (vehicle && !vehicle.supportedLoadSizes.includes(loadSize)) {
      setSelectedVehicle(null);
    }
  }, [loadSize, selectedVehicle]);

  const estimatedPrice = estimatePrice(selectedVehicle, loadSize, distanceKm);
  const selectedVehicleItem = VEHICLES.find((vehicle: VehicleItem) => vehicle.id === selectedVehicle) || null;
  const selectedLoadSizeInfo = getLoadSizeByKey(loadSize);

  const canContinue = !!selectedVehicle && !!pickupLocation && !!dropoffLocation && !!loadDescription.trim() && !!loadSize && !loadingLocation;

  const handleContinue = () => {
    if (!canContinue || !pickupLocation || !dropoffLocation || !selectedVehicle || !loadSize) {
      Alert.alert("Incomplete request", "Please complete pickup, drop-off, load description, load size, and vehicle selection.");
      return;
    }

    setCurrentRequest({
      pickupAddress: pickupLocation.address || "",
      pickupLat: pickupLocation.latitude,
      pickupLng: pickupLocation.longitude,
      dropoffAddress: dropoffLocation.address || "",
      dropoffLat: dropoffLocation.latitude,
      dropoffLng: dropoffLocation.longitude,
      vehicleType: selectedVehicle,
      loadDescription: loadDescription.trim(),
      loadSize,
      specialNotes: specialNotes.trim(),
      estimatedPrice,
      distanceKm,
    });

    router.push({
      pathname: "/(customer)/request",
      params: {
        pickup: pickupLocation.address || "",
        pickupLat: String(pickupLocation.latitude),
        pickupLng: String(pickupLocation.longitude),
        dropoff: dropoffLocation.address || "",
        dropoffLat: String(dropoffLocation.latitude),
        dropoffLng: String(dropoffLocation.longitude),
        vehicleType: selectedVehicle,
        vehicle: selectedVehicle,
        loadDescription: loadDescription.trim(),
        loadSize,
        specialNotes: specialNotes.trim(),
        estimatedPrice: String(estimatedPrice),
        distanceKm: String(distanceKm),
      },
    });
  };

  const onRefresh = () => {
    fetchActiveTrip();
    fetchRecentTrips();
  };

  const activeStatusColors = activeTrip ? getStatusColor(activeTrip.status) : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <Text style={styles.greeting}>{getGreeting()}!</Text>
          <Text style={styles.title}>Request Transport</Text>
          <Text style={styles.subtitle}>Move stock, household items, parcels, or business goods with the right vehicle.</Text>

          {!loadingDashboard && activeTrip && activeStatusColors ? (
            <TouchableOpacity
              style={[styles.activeTripCard, { backgroundColor: activeStatusColors.bg }]}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/(customer)/live-trip", params: { tripId: activeTrip.id } })}
            >
              <View style={styles.activeTripTop}>
                <Text style={[styles.activeTripLabel, { color: activeStatusColors.text }]}>Active Trip</Text>
                <Text style={[styles.activeTripStatus, { color: activeStatusColors.text }]}>
                  {activeTrip.status.replace(/_/g, " ")}
                </Text>
              </View>
              <Text style={styles.activeTripRoute} numberOfLines={2}>
                {activeTrip.pickupAddress} → {activeTrip.dropoffAddress}
              </Text>
              <View style={styles.activeTripBottom}>
                <Text style={styles.activeTripPrice}>KES {Number(activeTrip.estimatedPrice || 0).toLocaleString()}</Text>
                <Text style={[styles.activeTripView, { color: activeStatusColors.text }]}>View Trip →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pickup Location</Text>
            {loadingLocation ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#111827" />
                <Text style={styles.loadingText}>Fetching your location...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.locationValue}>{pickupLocation?.address || "Location not available"}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={getUserLocation}>
                  <Text style={styles.secondaryButtonText}>Refresh Pickup Location</Text>
                </TouchableOpacity>
              </>
            )}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Drop-off Location</Text>
            <DropoffSearch onSelect={handleDropoffSelect} />
            {dropoffLocation ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Selected Drop-off</Text>
                <Text style={styles.previewValue}>{dropoffLocation.address}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Load Description</Text>
            <TextInput style={styles.input} placeholder="Example: Boxes, electronics, groceries, furniture..." value={loadDescription} onChangeText={setLoadDescription} multiline />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Load Size</Text>
            <TouchableOpacity style={styles.selectorButton} onPress={() => setLoadSizeModalVisible(true)}>
              <Text style={styles.selectorButtonText}>
                {selectedLoadSizeInfo ? `${selectedLoadSizeInfo.label} — ${selectedLoadSizeInfo.weightRange}` : "Select load size"}
              </Text>
            </TouchableOpacity>
            {selectedLoadSizeInfo ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Selected Load Size</Text>
                <Text style={styles.previewValue}>{selectedLoadSizeInfo.description}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Special Notes</Text>
            <TextInput style={styles.input} placeholder="Optional notes for the transporter" value={specialNotes} onChangeText={setSpecialNotes} multiline />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Choose Vehicle</Text>
            {VEHICLES.map((vehicle: VehicleItem) => {
              const allowed = isVehicleAllowedForLoadSize(vehicle.id, loadSize);
              return (
                <VehicleCard
                  key={vehicle.id}
                  name={vehicle.name}
                  capacity={vehicle.capacity}
                  icon={vehicle.icon}
                  isSelected={selectedVehicle === vehicle.id}
                  onPress={() => setSelectedVehicle(vehicle.id)}
                  price={allowed ? estimatePrice(vehicle.id, loadSize, distanceKm) : undefined}
                  disabled={!allowed}
                />
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selected Vehicle</Text>
              <Text style={styles.summaryValue}>{selectedVehicleItem?.name || "Not selected"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{distanceKm} km</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated Price</Text>
              <Text style={styles.summaryPrice}>KES {estimatedPrice}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.primaryButton, !canContinue ? styles.primaryButtonDisabled : null]} disabled={!canContinue} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Continue to Review</Text>
          </TouchableOpacity>

          {!loadingDashboard && recentTrips.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.recentTitle}>Recent Trips</Text>
              {recentTrips.map((trip) => {
                const sc = getStatusColor(trip.status);
                return (
                  <TouchableOpacity key={trip.id} style={styles.recentCard} activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(customer)/live-trip", params: { tripId: trip.id } })}
                  >
                    <View style={styles.recentLeft}>
                      <Text style={styles.recentRoute} numberOfLines={1}>{trip.pickupAddress} → {trip.dropoffAddress}</Text>
                      <Text style={styles.recentDate}>{new Date(trip.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.recentBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.recentBadgeText, { color: sc.text }]}>{trip.status.replace(/_/g, " ")}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <LoadSizeSelector visible={loadSizeModalVisible} selectedValue={loadSize} onClose={() => setLoadSizeModalVisible(false)} onSelect={(value: LoadSize) => setLoadSize(value)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  scrollContainer: { paddingBottom: 28 },
  container: { flex: 1, padding: 16, paddingTop: 56, backgroundColor: "#ffffff" },
  greeting: { fontSize: 16, color: "#6b7280", fontWeight: "600", marginBottom: 2 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#6b7280", marginBottom: 18, lineHeight: 22 },

  activeTripCard: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "transparent" },
  activeTripTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  activeTripLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  activeTripStatus: { fontSize: 13, fontWeight: "900", textTransform: "capitalize" },
  activeTripRoute: { fontSize: 14, color: "#374151", fontWeight: "600", marginBottom: 10, lineHeight: 20 },
  activeTripBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeTripPrice: { fontSize: 18, fontWeight: "900", color: "#111827" },
  activeTripView: { fontSize: 14, fontWeight: "800" },

  sectionCard: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 12 },
  loadingWrap: { flexDirection: "row", alignItems: "center" },
  loadingText: { marginLeft: 10, color: "#6b7280", fontSize: 14 },
  locationValue: { fontSize: 15, color: "#111827", lineHeight: 21, marginBottom: 12 },
  input: { minHeight: 54, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", textAlignVertical: "top" },
  selectorButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  selectorButtonText: { fontSize: 15, color: "#111827", lineHeight: 20 },
  previewBox: { marginTop: 12, backgroundColor: "#f9fafb", borderRadius: 12, padding: 12 },
  previewLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  previewValue: { fontSize: 14, color: "#111827", lineHeight: 20 },
  summaryCard: { backgroundColor: "#111827", borderRadius: 18, padding: 16, marginBottom: 16 },
  summaryRow: { marginBottom: 10 },
  summaryLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  summaryValue: { fontSize: 15, color: "#ffffff", fontWeight: "600" },
  summaryPrice: { fontSize: 20, color: "#ffffff", fontWeight: "800" },
  primaryButton: { backgroundColor: "#111827", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  secondaryButton: { borderRadius: 14, borderWidth: 1, borderColor: "#d1d5db", paddingVertical: 13, alignItems: "center" },
  secondaryButtonText: { color: "#111827", fontWeight: "700", fontSize: 14 },
  errorText: { marginTop: 10, color: "#b91c1c", fontSize: 14 },

  recentSection: { marginTop: 18, marginBottom: 10 },
  recentTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 12 },
  recentCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  recentLeft: { flex: 1, marginRight: 10 },
  recentRoute: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  recentDate: { fontSize: 12, color: "#9ca3af" },
  recentBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  recentBadgeText: { fontSize: 11, fontWeight: "900" },
});
