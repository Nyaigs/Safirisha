import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapPressEvent, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingSheet } from "../../../components/booking/BookingSheet";
import { LocationSearchOverlay } from "../../../components/booking/LocationSearchOverlay";
import { BottomSheet } from "../../../components/ui/bottom-sheet";
import { StateMessage } from "../../../components/ui/state-message";
import { design } from "../../../constants/design";
import { useLayout } from "../../../constants/layout";
import { useBookingFlow } from "../../../hooks/useBookingFlow";
import { useCustomerStore } from "../../../store/customer";
import { useTripStore } from "../../../store/trip";
import { useNotificationsStore } from "../../../store/notifications";
import { useUIStore } from "../../../store/ui";
import { AppLocation, DropoffPlace } from "../../../types";

const nairobi = { latitude: -1.286389, longitude: 36.817223, latitudeDelta: 0.06, longitudeDelta: 0.06 };

type VehicleTile = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  vehicle: "bike" | "tuktuk" | "pickup" | "lorry" | null;
  loadSize: "Small" | "Medium" | null;
};

const VEHICLE_TILES: VehicleTile[] = [
  { key: "bike", label: "Boda", icon: "motorbike", vehicle: "bike", loadSize: "Small" },
  { key: "tuktuk", label: "Tuk", icon: "rickshaw", vehicle: "tuktuk", loadSize: "Small" },
  { key: "pickup", label: "Pickup", icon: "car-pickup", vehicle: "pickup", loadSize: "Small" },
  { key: "lorry", label: "Lorry", icon: "truck-outline", vehicle: "lorry", loadSize: "Medium" },
];

export default function HomeScreen() {
  const { spacing } = useLayout();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const flow = useBookingFlow();
  const params = useLocalSearchParams<{ destination?: string }>();
  const { step, choosePickup, chooseDropoff, requestPayload } = flow;
  const [currentLocation, setCurrentLocation] = useState<AppLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [mapPicking, setMapPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchField, setSearchField] = useState<"pickup" | "dropoff">("dropoff");
  const [initialPlaceQuery, setInitialPlaceQuery] = useState("");

  useEffect(() => {
    if (params.destination) {
      setInitialPlaceQuery(params.destination);
      setSearchField("dropoff");
      setSearchOpen(true);
      flow.setStep("pickup");
    }
  }, [flow.setStep, params.destination]);

  const activeTrip = useCustomerStore((state) => state.activeTrip);
  const fetchActiveTrip = useCustomerStore((state) => state.fetchActiveTrip);
  const recentTrips = useCustomerStore((state) => state.recentTrips);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount);
  const setSheetOpen = useUIStore((s) => s.setSheetOpen);
  const fetchRecentTrips = useCustomerStore((state) => state.fetchRecentTrips);
  useEffect(() => {
    const shouldOpen = flow.step !== "idle" && !mapPicking;
    setSheetOpen(shouldOpen);
    return () => setSheetOpen(false);
  }, [flow.step, mapPicking, setSheetOpen]);


  useFocusEffect(
    useCallback(() => {
      fetchActiveTrip();
      fetchRecentTrips();
    }, [fetchActiveTrip, fetchRecentTrips]),
  );

  const moveTo = useCallback(
    (point: AppLocation) =>
      mapRef.current?.animateToRegion(
        { latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        450,
      ),
    [],
  );

  const getCurrentLocation = useCallback(async (): Promise<AppLocation | null> => {
    setLoadingLocation(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission is off. Search or pin your location on the map instead.");
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(result.coords);
      const point = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        address:
          [place?.name, place?.street, place?.district, place?.city].filter(Boolean).join(", ") ||
          "Current location",
      };
      setCurrentLocation(point);
      moveTo(point);
      return point;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "We could not find your location.");
      return null;
    } finally {
      setLoadingLocation(false);
    }
  }, [moveTo]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return getCurrentLocation();
    });
    return () => {
      active = false;
    };
  }, [getCurrentLocation]);

  const useCurrentLocation = useCallback(async () => {
    const point = await getCurrentLocation();
    if (!point) return;
    if (step === "dropoff") chooseDropoff(point);
    else choosePickup(point);
  }, [chooseDropoff, choosePickup, getCurrentLocation, step]);

  const chooseSearch = useCallback(
    (place: DropoffPlace) => {
      const point = { ...place, placeId: place.id };
      moveTo(point);
      if (step === "pickup") choosePickup(point);
      else chooseDropoff(point);
    },
    [chooseDropoff, choosePickup, moveTo, step],
  );

  const mapPress = useCallback(
    async (event: MapPressEvent) => {
      if (!mapPicking) return;
      const point = { ...event.nativeEvent.coordinate, address: "Pinned location" };
      try {
        const [place] = await Location.reverseGeocodeAsync(point);
        point.address =
          [place?.name, place?.street, place?.district, place?.city].filter(Boolean).join(", ") ||
          point.address;
      } catch {
        /* keep pin label */
      }
      if (step === "pickup") choosePickup(point);
      else if (step === "dropoff") chooseDropoff(point);
      setMapPicking(false);
    },
    [chooseDropoff, choosePickup, mapPicking, step],
  );

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
      if (!tripId) {
        Alert.alert("Request failed", useTripStore.getState().error || "Please try again.");
        return;
      }
      const createdTrip = useTripStore.getState().currentTrip;
      router.replace({
        pathname: "/(customer)/searching",
        params: {
          tripId,
          pickup: createdTrip?.pickupAddress || requestPayload.pickupAddress,
          dropoff: createdTrip?.dropoffAddress || requestPayload.dropoffAddress,
          vehicleType: createdTrip?.vehicleType || requestPayload.vehicleType,
          loadSize: createdTrip?.loadSize || requestPayload.loadSize,
          estimatedPrice: String(createdTrip?.estimatedPrice ?? requestPayload.estimatedPrice),
          distanceKm: String(createdTrip?.distanceKm ?? requestPayload.distanceKm),
        },
      });
    };

    if (flow.distanceKm < 0.05) {
      Alert.alert("Very short trip", "Pickup and drop-off are very close. Is this intentional?", [
        { text: "Edit locations", style: "cancel" },
        { text: "Continue", onPress: () => void createRequest() },
      ]);
      return;
    }

    await createRequest();
  }, [flow.distanceKm, requestPayload]);

  const openSearchForDropoff = useCallback(() => {
    setInitialPlaceQuery("");
    setSearchField("dropoff");
    setSearchOpen(true);
  }, []);

  const openSearchForSavedPlace = useCallback((address: string) => {
    setInitialPlaceQuery(address);
    setSearchField("dropoff");
    setSearchOpen(true);
  }, []);

  const handleVehicleTile = useCallback(
    (tile: VehicleTile) => {
      if (!tile.vehicle) {
        openSearchForDropoff();
        return;
      }
      if (tile.loadSize) flow.setLoadSize(tile.loadSize);
      flow.setVehicle(tile.vehicle);
      flow.setStep("pickup");
    },
    [flow, openSearchForDropoff],
  );

  if (activeTrip) {
    return (
      <View
        style={[
          styles.active,
          {
            paddingTop: insets.top + design.spacing.lg,
            paddingBottom: insets.bottom + design.spacing.lg,
          },
        ]}
      >
        <Text style={styles.activeTitle}>You have an active delivery</Text>
        <Text style={styles.activeText}>
          {activeTrip.pickupAddress} → {activeTrip.dropoffAddress}
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: "/(customer)/live-trip", params: { tripId: activeTrip.id } })
          }
          style={styles.activeButton}
        >
          <Text style={styles.activeButtonText}>Track delivery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mapPicking) {
    return (
      <View style={styles.screen}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={
            currentLocation
              ? {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }
              : nairobi
          }
          showsUserLocation
          onPress={mapPress}
        >
          {flow.pickup && <Marker coordinate={flow.pickup} pinColor={design.colors.success} title="Pickup" />}
          {flow.dropoff && <Marker coordinate={flow.dropoff} pinColor={design.colors.danger} title="Drop-off" />}
          {flow.pickup && flow.dropoff && (
            <Polyline coordinates={[flow.pickup, flow.dropoff]} strokeColor={design.colors.brand} strokeWidth={4} />
          )}
        </MapView>

        <TouchableOpacity
          style={[styles.mapBack, { top: insets.top + design.spacing.sm }]}
          onPress={() => setMapPicking(false)}
        >
          <Ionicons name="arrow-back" size={22} color={design.colors.ink} />
        </TouchableOpacity>

        <View style={[styles.mapSheet, { paddingBottom: insets.bottom + design.spacing.md }]}>
          <Text style={styles.mapSheetTitle}>
            Set your {flow.step === "pickup" ? "pickup" : "destination"}
          </Text>
          <Text style={styles.mapSheetSubtitle}>Drag map to move pin</Text>

          <TouchableOpacity style={styles.mapSearchRow} onPress={openSearchForDropoff}>
            <View style={styles.mapSearchSquare} />
            <Text style={styles.mapSearchText}>Where to?</Text>
            <Ionicons name="search" size={20} color={design.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapCta}
            onPress={() => {
              const center = currentLocation ?? nairobi;
              if (flow.step === "pickup") choosePickup(center);
              else chooseDropoff(center);
              setMapPicking(false);
            }}
          >
            <Text style={styles.mapCtaText}>
              {flow.step === "pickup" ? "Set pickup" : "Search destination"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.homeScroll}
        contentContainerStyle={{
          paddingTop: insets.top + design.spacing.sm,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.locationPill}>
            <View style={styles.currentDot} />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentLocation?.address?.split(",")[0] || "Current location"}
            </Text>
            <Ionicons name="chevron-down" size={14} color={design.colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push("/(customer)/notifications")}
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={design.colors.ink} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.searchPill} onPress={openSearchForDropoff}>
          <Ionicons name="search-outline" size={20} color={design.colors.ink} />
          <Text style={styles.searchText}>{params.destination || "Where to?"}</Text>
          <View style={styles.laterChip}>
            <Ionicons name="calendar-outline" size={13} color={design.colors.ink} />
            <Text style={styles.laterText}>Later</Text>
          </View>
        </TouchableOpacity>

        {recentTrips.length > 0 && (
          <View style={styles.recentCard}>
            {recentTrips.slice(0, 2).map((trip, idx) => (
              <TouchableOpacity
                key={trip.id}
                style={[styles.recentRow, idx === 0 && styles.recentRowBorder]}
                onPress={() => openSearchForSavedPlace(trip.dropoffAddress)}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name="time-outline" size={18} color={design.colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {trip.dropoffAddress.split(",")[0]}
                  </Text>
                  <Text style={styles.recentAddress} numberOfLines={1}>
                    {trip.dropoffAddress}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={design.colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Start a delivery</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vehicleRow}
        >
          {VEHICLE_TILES.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.vehicleTile}
              onPress={() => handleVehicleTile(item)}
            >
              <View style={styles.vehicleIcon}>
                <MaterialCommunityIcons name={item.icon} size={28} color={design.colors.ink} />
              </View>
              <Text style={styles.vehicleLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            { n: "1", text: "Set your pickup and drop-off" },
            { n: "2", text: "Tell us what you are moving" },
            { n: "3", text: "A nearby driver picks it up" },
          ].map((step) => (
            <View key={step.n} style={styles.howRow}>
              <View style={styles.howNumber}>
                <Text style={styles.howNumberText}>{step.n}</Text>
              </View>
              <Text style={styles.howText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <StateMessage tone="error" title="Location unavailable" description={error} />
            <TouchableOpacity
              style={styles.manualLocation}
              onPress={() => {
                setError(null);
                flow.setStep(flow.step === "idle" ? "pickup" : flow.step);
              }}
            >
              <Text style={styles.manualLocationText}>Choose a location manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={flow.step !== "idle" && !mapPicking}
        snapPoints={[40, 70, 95]}
        initialSnap={0}
      >
        <BookingSheet
          flow={flow}
          currentLocation={currentLocation}
          loadingLocation={loadingLocation}
          submitting={submitting}
          onCurrentLocation={useCurrentLocation}
          onMapPick={() => setMapPicking(true)}
          onSearch={chooseSearch}
          onOpenSearch={(kind) => {
            setSearchField(kind);
            setSearchOpen(true);
          }}
          onSubmit={submit}
        />
      </BottomSheet>

      <LocationSearchOverlay
        visible={searchOpen}
        initialField={searchField}
        initialQuery={initialPlaceQuery}
        pickup={flow.pickup}
        dropoff={flow.dropoff}
        currentLocation={currentLocation}
        onClose={() => setSearchOpen(false)}
        onSelectPickup={(place) => {
          flow.choosePickup(place);
          moveTo(place);
          flow.setStep("dropoff");
        }}
        onSelectDropoff={(place) => {
          flow.chooseDropoff(place);
          moveTo(place);
          flow.setStep("details");
        }}
        onUseCurrentLocation={getCurrentLocation}
        onPickOnMap={(kind) => {
          setSearchOpen(false);
          setSearchField(kind);
          flow.setStep(kind);
          setMapPicking(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F5" },
  homeScroll: { flex: 1, backgroundColor: "#F5F5F5" },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: design.spacing.md,
    marginBottom: design.spacing.sm,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: design.colors.surface,
    paddingHorizontal: design.spacing.md,
    paddingVertical: 8,
    borderRadius: design.radius.pill,
    maxWidth: "75%",
    ...design.shadow,
  },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: design.colors.info },
  locationText: { ...design.typography.label, color: design.colors.ink, flexShrink: 1 },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: design.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },


  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.pill,
    paddingHorizontal: design.spacing.md,
    paddingVertical: 14,
    marginHorizontal: design.spacing.md,
    marginBottom: design.spacing.md,
    ...design.shadow,
  },
  searchText: { ...design.typography.body, color: design.colors.ink, flex: 1 },
  laterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.pill,
  },
  laterText: { ...design.typography.caption, color: design.colors.ink, fontWeight: "600" },

  recentCard: {
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    marginHorizontal: design.spacing.md,
    marginBottom: design.spacing.md,
    overflow: "hidden",
    ...design.shadow,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    paddingHorizontal: design.spacing.md,
    paddingVertical: 14,
  },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: design.colors.border },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: design.radius.md,
    backgroundColor: design.colors.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  recentName: { ...design.typography.label, color: design.colors.ink, marginBottom: 2 },
  recentAddress: { ...design.typography.caption, color: design.colors.muted },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: design.spacing.md,
    marginBottom: design.spacing.sm,
  },
  sectionTitle: { ...design.typography.heading, color: design.colors.ink },

  vehicleRow: { gap: design.spacing.md, paddingHorizontal: design.spacing.md, paddingBottom: design.spacing.md },
  vehicleTile: { alignItems: "center", width: 76, gap: design.spacing.xs },
  vehicleIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },
  vehicleLabel: { ...design.typography.caption, color: design.colors.ink, fontWeight: "600" },

  howItWorks: {
    marginHorizontal: design.spacing.md,
    marginTop: design.spacing.lg,
    padding: design.spacing.md,
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    gap: design.spacing.sm,
    ...design.shadow,
  },
  howTitle: { ...design.typography.heading, color: design.colors.ink, marginBottom: design.spacing.xs },
  howRow: { flexDirection: "row", alignItems: "center", gap: design.spacing.sm },
  howNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: design.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  howNumberText: { ...design.typography.caption, color: design.colors.brand, fontWeight: "700" },
  howText: { ...design.typography.body, color: design.colors.ink, flex: 1 },
  errorBox: { marginHorizontal: design.spacing.md, marginTop: design.spacing.md },
  manualLocation: { paddingVertical: design.spacing.sm, alignItems: "center" },
  manualLocationText: { ...design.typography.label, color: design.colors.brand },

  mapBack: {
    position: "absolute",
    left: design.spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },
  mapSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: design.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: design.spacing.md,
    paddingTop: design.spacing.lg,
  },
  mapSheetTitle: { ...design.typography.title, color: design.colors.ink, textAlign: "center" },
  mapSheetSubtitle: {
    ...design.typography.body,
    color: design.colors.muted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: design.spacing.md,
  },
  mapSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    paddingHorizontal: design.spacing.md,
    paddingVertical: 14,
    backgroundColor: design.colors.subtle,
    borderRadius: design.radius.md,
    marginBottom: design.spacing.md,
  },
  mapSearchSquare: { width: 14, height: 14, borderRadius: 2, backgroundColor: design.colors.ink },
  mapSearchText: { ...design.typography.body, color: design.colors.muted, flex: 1 },
  mapCta: {
    backgroundColor: design.colors.ink,
    paddingVertical: 16,
    borderRadius: design.radius.md,
    alignItems: "center",
  },
  mapCtaText: { ...design.typography.label, color: design.colors.white, fontWeight: "700" },

  active: {
    flex: 1,
    paddingHorizontal: design.spacing.lg,
    justifyContent: "center",
    backgroundColor: design.colors.surface,
  },
  activeTitle: { ...design.typography.title, color: design.colors.ink, marginBottom: design.spacing.sm },
  activeText: { ...design.typography.body, color: design.colors.muted, marginBottom: design.spacing.lg },
  activeButton: {
    backgroundColor: design.colors.brand,
    paddingVertical: 16,
    borderRadius: design.radius.md,
    alignItems: "center",
  },
  activeButtonText: { ...design.typography.label, color: design.colors.white, fontWeight: "700" },
});
