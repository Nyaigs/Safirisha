import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTripStore, validateTripRequestParams } from "../../store/trip";

function getVehicleIcon(vehicle?: string) {
  const normalized = String(vehicle || "").toLowerCase();
  if (normalized.includes("tuk")) return "rickshaw";
  if (normalized.includes("pickup")) return "truck-cargo-container";
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

export default function RequestScreen() {
  const [submitting, setSubmitting] = useState(false);

  const {
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

  const validatePayload = () => {
    const missing: string[] = [];
    if (!pickup) missing.push("Pickup address");
    if (!pickupLat) missing.push("Pickup latitude");
    if (!pickupLng) missing.push("Pickup longitude");
    if (!dropoff) missing.push("Dropoff address");
    if (!dropoffLat) missing.push("Dropoff latitude");
    if (!dropoffLng) missing.push("Dropoff longitude");
    if (!vehicleType && !vehicle) missing.push("Vehicle type");
    if (!loadSize) missing.push("Load size");
    if (!estimatedPrice) missing.push("Estimated price");
    if (!distanceKm) missing.push("Distance");
    return missing;
  };

  const handleRequestDriver = async () => {
    const missing = validatePayload();
    if (missing.length > 0) {
      Alert.alert(
        "Missing trip details",
        `Please complete: ${missing.join(", ")}`,
      );
      return;
    }

    const tripParams = {
      pickupAddress: pickup || "",
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      dropoffAddress: dropoff || "",
      dropoffLat: Number(dropoffLat),
      dropoffLng: Number(dropoffLng),
      vehicleType: vehicleType || vehicle || "",
      loadDescription: loadDescription || null,
      loadSize: loadSize || "",
      specialNotes: specialNotes || null,
      estimatedPrice: Number(estimatedPrice),
      distanceKm: Number(distanceKm),
    };

    const validationErrors = validateTripRequestParams(tripParams);
    if (validationErrors.length > 0) {
      Alert.alert("Invalid request", validationErrors.join(", "));
      return;
    }

    useTripStore.getState().setCurrentRequest(tripParams);

    try {
      setSubmitting(true);

      const tripId = await useTripStore.getState().createTrip();
      if (!tripId) {
        const error = useTripStore.getState().error;
        Alert.alert("Request failed", error || "Failed to create trip. Please try again.");
        return;
      }

      router.replace({
        pathname: "/(customer)/searching",
        params: {
          tripId,
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
        },
      });
    } catch (error: any) {
      Alert.alert(
        "Request failed",
        error?.message || "Failed to create trip. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            {vehicleLabel}
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
});
