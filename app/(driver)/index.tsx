import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import {
  connectSocket,
  onDriverAvailabilityUpdated,
} from "../../lib/socket";
import { useDriverStore } from "../../store/driver";
import type { Trip } from "../../types/trip";

function getVehicleIcon(vehicle?: string | null) {
  if (!vehicle) return "truck-fast";
  const v = vehicle.toLowerCase();
  if (v.includes("tuk") || v.includes("rickshaw")) return "rickshaw-electric";
  if (v.includes("pickup")) return "truck-cargo-container";
  if (v.includes("lorry") || v.includes("truck")) return "truck";
  if (v.includes("bike") || v.includes("boda") || v.includes("motor"))
    return "motorbike";
  return "truck-fast";
}

function formatVehicle(vehicle?: string | null) {
  if (!vehicle) return "Vehicle";
  return vehicle.replace(/_/g, " ");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DriverDashboard() {
  const driverProfile = useDriverStore((s) => s.driverProfile);
  const activeTrip = useDriverStore((s) => s.activeTrip);
  const isOnline = useDriverStore((s) => s.isOnline);
  const isLoading = useDriverStore((s) => s.isLoading);
  const isToggling = useDriverStore((s) => s.isToggling);
  const error = useDriverStore((s) => s.error);
  const initialize = useDriverStore((s) => s.initialize);
  const goOnline = useDriverStore((s) => s.goOnline);
  const goOffline = useDriverStore((s) => s.goOffline);
  const setActiveTrip = useDriverStore((s) => s.setActiveTrip);

  const [refreshing, setRefreshing] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Location unavailable");
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const vehicleIcon = useMemo(
    () => getVehicleIcon(driverProfile?.vehicleType),
    [driverProfile?.vehicleType],
  );

  useEffect(() => {
    initialize();
  }, [initialize]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [initialize]),
  );

  useEffect(() => {
    const cleanup = onDriverAvailabilityUpdated((payload) => {
      if (!payload?.driverId || payload.driverId !== driverProfile?.id) return;
      const online =
        payload.availability === "ONLINE" || payload.availability === "BUSY";
      useDriverStore.getState().setOnline(online);
    });
    return cleanup;
  }, [driverProfile?.id]);

  useEffect(() => {
    const socket = connectSocket();
    socket.on("trip_updated", (payload: { trip?: Trip }) => {
      if (payload?.trip) setActiveTrip(payload.trip);
    });
    return () => {
      socket.off("trip_updated");
    };
  }, [setActiveTrip]);

  useEffect(() => {
    if (!isOnline) {
      stopLocationTracking();
      return;
    }

    startLocationTracking();

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") startLocationTracking();
      else stopLocationTracking();
    });

    return () => {
      stopLocationTracking();
      appStateSub.remove();
    };
  }, [isOnline]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    if (isOnline) pulse.start();
    else pulseAnim.setValue(1);
    return () => pulse.stop();
  }, [isOnline, pulseAnim]);

  const startLocationTracking = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return;

    watchRef.current?.remove();

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const place = places?.[0];
      if (place) {
        const parts = [place.city, place.region, place.country].filter(Boolean);
        if (parts.length) setLocationLabel(parts.join(", "));
      }
    } catch {
      setLocationLabel("Location available");
    }

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async (loc) => {
        try {
          await apiFetch("/drivers/me/location", {
            method: "PATCH",
            body: { lat: loc.coords.latitude, lng: loc.coords.longitude },
          });
        } catch {
          /* silent */
        }
      },
    );
  }, []);

  const stopLocationTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const handleToggle = useCallback(async () => {
    if (isToggling) return;

    try {
      if (isOnline) {
        await goOffline();
        stopLocationTracking();
      } else {
        await goOnline();
        startLocationTracking();
      }
    } catch (err: any) {
      Alert.alert("Toggle failed", err?.message || "Could not change availability");
    }
  }, [isOnline, isToggling, goOnline, goOffline, startLocationTracking, stopLocationTracking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initialize();
    setRefreshing(false);
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error && !driverProfile) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color="#94A3B8" />
        <Text style={styles.errorTitle}>Could not load dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={initialize}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {getGreeting()},{" "}
            {driverProfile?.fullName?.split(" ")[0] || "Driver"}
          </Text>
          <View style={styles.vehicleRow}>
            <MaterialCommunityIcons name={vehicleIcon as any} size={16} color="#94A3B8" />
            <Text style={styles.vehicleText}>
              {formatVehicle(driverProfile?.vehicleType)}
              {driverProfile?.plateNumber ? ` • ${driverProfile.plateNumber}` : ""}
            </Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(driverProfile?.fullName || "D").charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.statusCard, isOnline ? styles.statusOnline : styles.statusOffline]}>
        <View style={styles.statusTop}>
          <View style={styles.statusLeft}>
            <Animated.View
              style={[
                styles.statusDot,
                { opacity: pulseAnim },
                isOnline ? styles.dotOnline : styles.dotOffline,
              ]}
            />
            <View>
              <Text style={styles.statusLabel}>
                {isOnline ? "You are online" : "You are offline"}
              </Text>
              <Text style={styles.statusSub}>
                {isOnline
                  ? "Receiving job requests in real-time"
                  : "Go online to start receiving jobs"}
              </Text>
            </View>
          </View>
          <View style={styles.availabilityBadge}>
            <Text style={[styles.availabilityBadgeText, isOnline ? styles.badgeOnlineText : styles.badgeOfflineText]}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.toggleButton,
            isOnline ? styles.toggleOnline : styles.toggleOffline,
            pressed && styles.togglePressed,
          ]}
          onPress={handleToggle}
          disabled={isToggling}
        >
          {isToggling ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name={isOnline ? "power" : "power-outline"}
                size={18}
                color="#fff"
              />
              <Text style={styles.toggleText}>
                {isOnline ? "Tap to go offline" : "Tap to go online"}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="cash" size={22} color="#059669" />
          <Text style={styles.statValue}>KES 0</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="briefcase-check" size={22} color="#2563EB" />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Jobs Done</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="star" size={22} color="#D97706" />
          <Text style={styles.statValue}>5.0</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {activeTrip && (
        <Pressable
          style={({ pressed }) => [
            styles.activeTripCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/(driver)/active-trip",
              params: { tripId: activeTrip.id },
            })
          }
        >
          <View style={styles.activeTripTop}>
            <View style={styles.activeTripIcon}>
              <Ionicons name="navigate" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTripLabel}>Active Trip</Text>
              <Text style={styles.activeTripStatus}>
                {activeTrip.status?.replace(/_/g, " ") || "In progress"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748B" />
          </View>
          <View style={styles.activeTripRoute}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </View>
          <View style={styles.activeTripAddresses}>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeTrip.pickupAddress}
            </Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeTrip.dropoffAddress}
            </Text>
          </View>
          <View style={styles.activeTripBottom}>
            <Text style={styles.activeTripPrice}>
              KES {Number(activeTrip.estimatedPrice || 0).toLocaleString()}
            </Text>
            <Text style={styles.activeTripView}>View Trip →</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.quickActions}>
        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
          onPress={() => router.push("/(driver)/jobs")}
        >
          <MaterialCommunityIcons name="briefcase-search" size={24} color="#2563EB" />
          <Text style={styles.quickActionLabel}>Jobs</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
          onPress={() => router.push("/(driver)/earnings")}
        >
          <MaterialCommunityIcons name="wallet" size={24} color="#059669" />
          <Text style={styles.quickActionLabel}>Earnings</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
          onPress={() => router.push("/(driver)/profile")}
        >
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={styles.quickActionLabel}>Profile</Text>
        </Pressable>
      </View>

      <View style={styles.locationCard}>
        <Ionicons name="location-outline" size={16} color="#64748B" />
        <Text style={styles.locationText}>{locationLabel}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vehicleText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  statusCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  statusOffline: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotOnline: {
    backgroundColor: "#16A34A",
  },
  dotOffline: {
    backgroundColor: "#DC2626",
  },
  statusLabel: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  availabilityBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  availabilityBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  badgeOnlineText: {
    color: "#16A34A",
  },
  badgeOfflineText: {
    color: "#DC2626",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  toggleOnline: {
    backgroundColor: "#16A34A",
  },
  toggleOffline: {
    backgroundColor: "#DC2626",
  },
  togglePressed: {
    opacity: 0.8,
  },
  toggleText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  activeTripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardPressed: {
    opacity: 0.7,
  },
  activeTripTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  activeTripIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  activeTripLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeTripStatus: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
    textTransform: "capitalize",
  },
  activeTripRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  routeDotEnd: {
    backgroundColor: "#DC2626",
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  activeTripAddresses: {
    gap: 4,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  activeTripBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  activeTripPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: "#059669",
  },
  activeTripView: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 6,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  locationText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    flex: 1,
  },
});
