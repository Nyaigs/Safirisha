import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { AppLocation, DropoffPlace, LoadSize, VehicleId } from "../../../types";
import { estimatePrice } from "../../../utils/pricing";

export default function HomeScreen() {
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadSizeModalVisible, setLoadSizeModalVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [pickupLocation, setPickupLocation] = useState<AppLocation | null>(
    null,
  );
  const [dropoffLocation, setDropoffLocation] = useState<AppLocation | null>(
    null,
  );

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleId | null>(
    null,
  );
  const [loadDescription, setLoadDescription] = useState("");
  const [loadSize, setLoadSize] = useState<LoadSize | null>(null);
  const [specialNotes, setSpecialNotes] = useState("");

  const generateRequestId = () =>
    `SFR-${Math.floor(10000 + Math.random() * 90000)}`;

  const getReadableAddress = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (!results || results.length === 0) {
        return "Current Location";
      }

      const place = results[0];

      const parts = [
        place.name,
        place.street,
        place.city,
        place.region,
        place.country,
      ].filter(Boolean);

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
        setErrorMsg(
          "Location permission denied. Please enable location access.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      const address = await getReadableAddress(latitude, longitude);

      setPickupLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      console.log("Location fetch failed:", error);
      setErrorMsg("Failed to fetch your current location.");
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  const handleDropoffSelect = (place: DropoffPlace) => {
    setDropoffLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
    });
  };

  const distanceKm = useMemo(() => {
    if (!pickupLocation || !dropoffLocation) return 0;

    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(dropoffLocation.latitude - pickupLocation.latitude);
    const dLng = toRad(dropoffLocation.longitude - pickupLocation.longitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(pickupLocation.latitude)) *
        Math.cos(toRad(dropoffLocation.latitude)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((R * c).toFixed(2));
  }, [pickupLocation, dropoffLocation]);

  const isVehicleAllowedForLoadSize = (
    vehicleId: VehicleId,
    selectedLoadSize: LoadSize | null,
  ) => {
    if (!selectedLoadSize) return true;

    const vehicle = VEHICLES.find((item: VehicleItem) => item.id === vehicleId);
    if (!vehicle) return false;

    return vehicle.supportedLoadSizes.includes(selectedLoadSize);
  };

  useEffect(() => {
    if (!selectedVehicle || !loadSize) return;

    const vehicle = VEHICLES.find(
      (item: VehicleItem) => item.id === selectedVehicle,
    );

    if (!vehicle) return;

    if (!vehicle.supportedLoadSizes.includes(loadSize)) {
      setSelectedVehicle(null);
    }
  }, [loadSize, selectedVehicle]);

  const estimatedPrice = estimatePrice(selectedVehicle, loadSize, distanceKm);

  const selectedVehicleItem =
    VEHICLES.find((vehicle: VehicleItem) => vehicle.id === selectedVehicle) ||
    null;

  const selectedLoadSizeInfo = getLoadSizeByKey(loadSize);

  const canContinue =
    !!selectedVehicle &&
    !!pickupLocation &&
    !!dropoffLocation &&
    !!loadDescription.trim() &&
    !!loadSize &&
    !loadingLocation;

  const handleContinue = () => {
    if (
      !canContinue ||
      !pickupLocation ||
      !dropoffLocation ||
      !selectedVehicle ||
      !loadSize
    ) {
      Alert.alert(
        "Incomplete request",
        "Please complete pickup, drop-off, load description, load size, and vehicle selection.",
      );
      return;
    }

    const requestId = generateRequestId();

    router.push({
      pathname: "/(customer)/request",
      params: {
        requestId,
        pickup: pickupLocation.address || "",
        pickupLat: String(pickupLocation.latitude),
        pickupLng: String(pickupLocation.longitude),
        dropoff: dropoffLocation.address || "",
        dropoffLat: String(dropoffLocation.latitude),
        dropoffLng: String(dropoffLocation.longitude),
        vehicle: selectedVehicleItem?.name || selectedVehicle,
        vehicleType: selectedVehicle,
        loadDescription: loadDescription.trim(),
        loadSize,
        specialNotes: specialNotes.trim(),
        estimatedPrice: String(estimatedPrice),
        distanceKm: String(distanceKm),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Request Transport</Text>
          <Text style={styles.subtitle}>
            Move stock, household items, parcels, or business goods with the
            right vehicle.
          </Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pickup Location</Text>

            {loadingLocation ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#111827" />
                <Text style={styles.loadingText}>
                  Fetching your location...
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.locationValue}>
                  {pickupLocation?.address || "Location not available"}
                </Text>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={getUserLocation}
                >
                  <Text style={styles.secondaryButtonText}>
                    Refresh Pickup Location
                  </Text>
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
                <Text style={styles.previewValue}>
                  {dropoffLocation.address}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Load Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: Boxes, electronics, groceries, furniture..."
              value={loadDescription}
              onChangeText={setLoadDescription}
              multiline
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Load Size</Text>

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setLoadSizeModalVisible(true)}
            >
              <Text style={styles.selectorButtonText}>
                {selectedLoadSizeInfo
                  ? `${selectedLoadSizeInfo.label} — ${selectedLoadSizeInfo.weightRange}`
                  : "Select load size"}
              </Text>
            </TouchableOpacity>

            {selectedLoadSizeInfo ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Selected Load Size</Text>
                <Text style={styles.previewValue}>
                  {selectedLoadSizeInfo.description}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Special Notes</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional notes for the transporter"
              value={specialNotes}
              onChangeText={setSpecialNotes}
              multiline
            />
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
                  price={
                    allowed
                      ? estimatePrice(vehicle.id, loadSize, distanceKm)
                      : undefined
                  }
                  disabled={!allowed}
                />
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selected Vehicle</Text>
              <Text style={styles.summaryValue}>
                {selectedVehicleItem?.name || "Not selected"}
              </Text>
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

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !canContinue ? styles.primaryButtonDisabled : null,
            ]}
            disabled={!canContinue}
            onPress={handleContinue}
          >
            <Text style={styles.primaryButtonText}>Continue to Review</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LoadSizeSelector
        visible={loadSizeModalVisible}
        selectedValue={loadSize}
        onClose={() => setLoadSizeModalVisible(false)}
        onSelect={(value: LoadSize) => {
          setLoadSize(value);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    paddingBottom: 28,
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 18,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
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
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    marginLeft: 10,
    color: "#6b7280",
    fontSize: 14,
  },
  locationValue: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 21,
    marginBottom: 12,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorButtonText: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 20,
  },
  previewBox: {
    marginTop: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "600",
  },
  summaryPrice: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    color: "#b91c1c",
    fontSize: 14,
  },
});
