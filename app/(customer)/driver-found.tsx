import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function getVehicleIcon(vehicle?: string) {
  const normalized = (vehicle || "").toLowerCase();

  if (normalized.includes("tuk")) return "rickshaw";
  if (normalized.includes("pickup")) return "truck-pickup";
  if (normalized.includes("lorry")) return "truck";
  if (normalized.includes("truck")) return "truck";
  return "truck-fast";
}

function formatStatus(status?: string) {
  if (!status) return "ACCEPTED";
  return status.replaceAll("_", " ");
}

export default function DriverFoundScreen() {
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
    driverId,
    driverName,
    driverPhone,
    plateNumber,
    driverVehicleType,
    status,
  } = useLocalSearchParams<{
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
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    plateNumber?: string;
    driverVehicleType?: string;
    status?: string;
  }>();

  const displayVehicle =
    driverVehicleType || vehicle || vehicleType || "Transport Vehicle";
  const vehicleIcon = getVehicleIcon(displayVehicle);

  const openDialer = async () => {
    if (!driverPhone) return;

    const url = `tel:${driverPhone}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return;
      await Linking.openURL(url);
    } catch {
      // keep silent here to avoid over-alerting
    }
  };

  const openLiveTrip = () => {
    router.push({
      pathname: "/(customer)/live-trip",
      params: {
        tripId: tripId || "",
        driverId: driverId || "",
        driverName: driverName || "",
        driverPhone: driverPhone || "",
        plateNumber: plateNumber || "",
        pickup: pickup || "",
        pickupLat: pickupLat || "",
        pickupLng: pickupLng || "",
        dropoff: dropoff || "",
        dropoffLat: dropoffLat || "",
        dropoffLng: dropoffLng || "",
        vehicle: vehicle || "",
        vehicleType: vehicleType || "",
        estimatedPrice: estimatedPrice || "0",
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(customer)/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Transporter Assigned</Text>
            <Text style={styles.subtitle}>
              Your request has been accepted and live trip tracking is now
              ready.
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={styles.statusText}>Driver Found</Text>
          </View>

          <View style={styles.heroVehicleWrap}>
            <View style={styles.heroVehicleIcon}>
              <MaterialCommunityIcons
                name={vehicleIcon as any}
                size={30}
                color="#111827"
              />
            </View>

            <View style={styles.heroVehicleTextWrap}>
              <Text style={styles.heroVehicleTitle}>
                {String(displayVehicle).replace(/_/g, " ")}
              </Text>
              <Text style={styles.heroVehicleSubtitle}>
                Status: {formatStatus(status)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroText}>
            Your transporter has accepted the request. You can now follow the
            trip live, see status changes, and confirm key delivery steps as the
            trip progresses.
          </Text>
        </View>

        <View style={styles.driverCard}>
          <Text style={styles.sectionTitle}>Assigned Driver</Text>

          <View style={styles.driverHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={28} color="#111827" />
            </View>

            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName || "Driver"}</Text>
              <Text style={styles.driverMeta}>
                Plate: {plateNumber || "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>
              {driverPhone || "Not available"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Type</Text>
            <Text style={styles.detailValue}>
              {String(displayVehicle).replace(/_/g, " ")}
            </Text>
          </View>

          {driverPhone ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openDialer}
            >
              <Text style={styles.secondaryButtonText}>Call Driver</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Trip ID</Text>
            <Text style={styles.itemValue}>{tripId || "Not available"}</Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Request ID</Text>
            <Text style={styles.itemValue}>{requestId || "Not available"}</Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Pickup</Text>
            <Text style={styles.itemValue}>{pickup || "Not set"}</Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Drop-off</Text>
            <Text style={styles.itemValue}>{dropoff || "Not set"}</Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Load</Text>
            <Text style={styles.itemValue}>
              {loadDescription || "Not provided"}
            </Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Load Size</Text>
            <Text style={styles.itemValue}>{loadSize || "Not selected"}</Text>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemLabel}>Special Notes</Text>
            <Text style={styles.itemValue}>{specialNotes || "None"}</Text>
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemHalf}>
              <Text style={styles.itemLabel}>Distance</Text>
              <Text style={styles.itemValue}>{distanceKm || "0"} km</Text>
            </View>

            <View style={styles.itemHalf}>
              <Text style={styles.itemLabel}>Estimated Price</Text>
              <Text style={styles.itemValue}>KES {estimatedPrice || "0"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#1d4ed8"
          />
          <Text style={styles.noticeText}>
            In the live trip screen, you’ll be able to track progress and later
            confirm pickup handover and delivery receipt at the right stages.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={openLiveTrip}>
          <Text style={styles.primaryButtonText}>Track Live Trip</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 28,
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#ffffff",
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
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 21,
  },
  heroCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#166534",
  },
  heroVehicleWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  heroVehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroVehicleTextWrap: {
    flex: 1,
  },
  heroVehicleTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  heroVehicleSubtitle: {
    fontSize: 14,
    color: "#166534",
    marginTop: 4,
  },
  heroText: {
    fontSize: 14,
    color: "#166534",
    lineHeight: 20,
  },
  driverCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  driverMeta: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
  },
  secondaryButton: {
    marginTop: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  tripCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  item: {
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    gap: 12,
  },
  itemHalf: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  itemValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
    lineHeight: 21,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    color: "#1e3a8a",
    lineHeight: 20,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
