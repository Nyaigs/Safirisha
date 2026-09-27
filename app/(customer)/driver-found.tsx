import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";

function getVehicleIcon(vehicle?: string) {
  const n = (vehicle || "").toLowerCase();
  if (n.includes("tuk")) return "rickshaw-electric";
  if (n.includes("pickup")) return "truck-cargo-container";
  if (n.includes("lorry")) return "truck";
  if (n.includes("truck")) return "truck-fast";
  if (n.includes("bike") || n.includes("boda") || n.includes("motor")) return "motorbike";
  return "truck-fast";
}

function formatStatus(status?: string) {
  if (!status) return "ACCEPTED";
  return status.replaceAll("_", " ");
}

export default function DriverFoundScreen() {
  const insets = useSafeAreaInsets();

  const {
    tripId, requestId, pickup, pickupLat, pickupLng,
    dropoff, dropoffLat, dropoffLng, vehicle, vehicleType,
    loadDescription, loadSize, specialNotes, estimatedPrice, distanceKm,
    driverId, driverName, driverPhone, plateNumber, driverVehicleType, status,
  } = useLocalSearchParams<{
    tripId?: string; requestId?: string;
    pickup?: string; pickupLat?: string; pickupLng?: string;
    dropoff?: string; dropoffLat?: string; dropoffLng?: string;
    vehicle?: string; vehicleType?: string;
    loadDescription?: string; loadSize?: string; specialNotes?: string;
    estimatedPrice?: string; distanceKm?: string;
    driverId?: string; driverName?: string; driverPhone?: string;
    plateNumber?: string; driverVehicleType?: string; status?: string;
  }>();

  const displayVehicle = driverVehicleType || vehicle || vehicleType || "Transport Vehicle";
  const vehicleIcon = getVehicleIcon(displayVehicle);

  const openDialer = async () => {
    if (!driverPhone) {
      Alert.alert("No phone number", "The driver's phone number is not available yet.");
      return;
    }
    const url = `tel:${driverPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) { Alert.alert("Call unavailable", "Your device cannot place calls right now."); return; }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Call failed", "Unable to open the phone dialer.");
    }
  };

  const openLiveTrip = () => {
    router.replace({
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
    <ScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        { paddingBottom: insets.bottom + design.spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, { paddingTop: insets.top + design.spacing.lg }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(customer)/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color={design.colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Driver assigned</Text>
            <Text style={styles.subtitle}>
              A nearby driver accepted your request and live tracking is ready.
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={styles.statusText}>Matched Successfully</Text>
          </View>

          <View style={styles.heroVehicleWrap}>
            <View style={styles.heroVehicleIcon}>
              <MaterialCommunityIcons name={vehicleIcon as any} size={30} color={design.colors.ink} />
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
            We found the closest suitable driver and assigned your request. You can now track the trip live and follow every major status update.
          </Text>
        </View>

        <View style={styles.driverCard}>
          <Text style={styles.sectionTitle}>Assigned Driver</Text>
          <View style={styles.driverHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={28} color={design.colors.ink} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName} numberOfLines={1}>
                {driverName || "Driver"}
              </Text>
              <Text style={styles.driverMeta}>
                Plate: {plateNumber || "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Type</Text>
            <Text style={styles.detailValue}>
              {String(displayVehicle).replace(/_/g, " ")}
            </Text>
          </View>

          {driverPhone ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={openDialer}>
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
            <Text style={styles.itemValue}>{loadDescription || "Not provided"}</Text>
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
          <Ionicons name="information-circle-outline" size={18} color="#1d4ed8" />
          <Text style={styles.noticeText}>
            Next up: open live tracking to see where your driver is, follow trip progress, and confirm pickup and delivery at the correct stages.
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
  scrollContainer: { backgroundColor: design.colors.surface },
  container: { flex: 1, paddingHorizontal: design.spacing.md, backgroundColor: design.colors.surface },
  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: design.spacing.md },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: design.spacing.md,
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 28, fontWeight: "800", color: design.colors.ink, marginBottom: design.spacing.xs },
  subtitle: { fontSize: 15, color: design.colors.muted, lineHeight: 21 },
  heroCard: {
    padding: design.spacing.md,
    borderRadius: design.radius.lg,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    marginBottom: design.spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    paddingHorizontal: design.spacing.sm,
    paddingVertical: design.spacing.xs,
    borderRadius: design.radius.pill,
    marginBottom: design.spacing.md,
  },
  statusText: { marginLeft: design.spacing.xs, fontSize: 12, fontWeight: "800", color: "#166534" },
  heroVehicleWrap: { flexDirection: "row", alignItems: "center", marginBottom: design.spacing.sm },
  heroVehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: design.colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: design.spacing.md,
  },
  heroVehicleTextWrap: { flex: 1 },
  heroVehicleTitle: { fontSize: 18, fontWeight: "800", color: design.colors.ink },
  heroVehicleSubtitle: { fontSize: 14, color: "#166534", marginTop: design.spacing.xs },
  heroText: { fontSize: 14, color: "#166534", lineHeight: 20 },
  driverCard: {
    padding: design.spacing.md,
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.white,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  driverHeader: { flexDirection: "row", alignItems: "center", marginBottom: design.spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: design.spacing.md,
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 18, fontWeight: "700", color: design.colors.ink },
  driverMeta: { fontSize: 14, color: design.colors.muted, marginTop: design.spacing.xs },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginTop: design.spacing.sm, gap: design.spacing.md },
  detailLabel: { fontSize: 14, color: design.colors.muted },
  detailValue: { flex: 1, fontSize: 14, color: design.colors.ink, fontWeight: "600", textAlign: "right" },
  secondaryButton: {
    marginTop: design.spacing.md,
    backgroundColor: "#f3f4f6",
    borderRadius: design.radius.md,
    paddingVertical: design.spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: { color: design.colors.ink, fontWeight: "700" },
  tripCard: {
    padding: design.spacing.md,
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.white,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: design.spacing.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: design.colors.ink, marginBottom: design.spacing.md },
  item: { marginBottom: design.spacing.sm },
  itemRow: { flexDirection: "row", gap: design.spacing.md },
  itemHalf: { flex: 1 },
  itemLabel: {
    fontSize: 12,
    color: design.colors.muted,
    marginBottom: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  itemValue: { fontSize: 15, color: design.colors.ink, fontWeight: "600", lineHeight: 21 },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: design.spacing.sm,
    padding: design.spacing.md,
    borderRadius: design.radius.lg,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: design.spacing.lg,
  },
  noticeText: { flex: 1, color: "#1e3a8a", lineHeight: 20, fontWeight: "600" },
  primaryButton: {
    backgroundColor: design.colors.ink,
    borderRadius: design.radius.lg,
    paddingVertical: design.spacing.md,
    alignItems: "center",
  },
  primaryButtonText: { color: design.colors.white, fontSize: 16, fontWeight: "700" },
});