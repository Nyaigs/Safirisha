import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "../../../components/ui/map-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../../constants/design";
import { maps } from "../../../lib/maps";
import { apiFetch } from "../../../lib/api";
import type { Trip } from "../../../types/trip";

const ACTIVE_STATUSES = new Set(["SEARCHING", "ACCEPTED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING"]);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
function parseTrip(value: unknown): Trip | null {
  if (!isRecord(value)) return null;
  const id = String(value.id ?? value.requestId ?? "");
  if (!id) return null;
  return {
    ...(value as unknown as Trip), id,
    createdAt: String(value.createdAt ?? ""),
    pickupAddress: String(value.pickupAddress ?? value.pickup ?? ""),
    dropoffAddress: String(value.dropoffAddress ?? value.dropoff ?? ""),
    pickupLat: Number(value.pickupLat ?? 0), pickupLng: Number(value.pickupLng ?? 0),
    dropoffLat: Number(value.dropoffLat ?? 0), dropoffLng: Number(value.dropoffLng ?? 0),
    estimatedPrice: Number(value.estimatedPrice ?? value.amount ?? 0),
    vehicleType: String(value.vehicleType ?? value.vehicle ?? "Transport"),
    status: String(value.status ?? "SEARCHING").toUpperCase() as Trip["status"],
  };
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
function money(value: number) { return `KES ${value.toLocaleString()}`; }

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const fetchTrips = useCallback(async () => {
    try {
      setError(null);
      const data: unknown = await apiFetch("/trips/my-trips", { method: "GET" });
      const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.trips) ? data.trips : [];
      const parsed = list.map(parseTrip).filter((trip): trip is Trip => trip !== null);
      setTrips(parsed);
      const completed = parsed.find((trip) => trip.status === "DELIVERED");
      if (completed && Number.isFinite(completed.pickupLat) && Number.isFinite(completed.dropoffLat)) {
        try {
          const result = await maps.getRoute({ lat: completed.pickupLat, lng: completed.pickupLng }, { lat: completed.dropoffLat, lng: completed.dropoffLng });
          setRoute(result?.polyline ?? []);
        } catch { setRoute([]); }
      } else setRoute([]);
    } catch {
      setError("We couldn't load your deliveries. Check your connection and try again.");
    }
  }, []);
  const loadTrips = useCallback(async () => { setLoading(true); await fetchTrips(); setLoading(false); }, [fetchTrips]);
  const refresh = useCallback(async () => { setRefreshing(true); await fetchTrips(); setRefreshing(false); }, [fetchTrips]);
  useFocusEffect(useCallback(() => { void loadTrips(); }, [loadTrips]));
  const completedTrips = useMemo(() => trips.filter((trip) => trip.status === "DELIVERED"), [trips]);
  const latest = completedTrips[0];
  const rebook = (trip: Trip) => router.push({ pathname: "/(customer)/(tabs)", params: { destination: trip.dropoffAddress } });
  const mapRegion = latest ? { latitude: (latest.pickupLat + latest.dropoffLat) / 2, longitude: (latest.pickupLng + latest.dropoffLng) / 2, latitudeDelta: Math.max(Math.abs(latest.pickupLat - latest.dropoffLat) * 2, 0.02), longitudeDelta: Math.max(Math.abs(latest.pickupLng - latest.dropoffLng) * 2, 0.02) } : { latitude: -1.286389, longitude: 36.817223, latitudeDelta: 0.04, longitudeDelta: 0.04 };

  return <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + design.spacing.lg, paddingBottom: insets.bottom + design.spacing.xl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} showsVerticalScrollIndicator={false}>
    <Text style={styles.title}>Activity</Text>
    {loading ? <ActivityIndicator color={design.colors.brand} style={styles.loading} /> : error ? <View style={styles.empty}><Text style={styles.emptyTitle}>Deliveries unavailable</Text><Text style={styles.muted}>{error}</Text><TouchableOpacity onPress={() => void loadTrips()}><Text style={styles.link}>Try again</Text></TouchableOpacity></View> : trips.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No deliveries yet</Text><Text style={styles.muted}>Your delivery activity will appear here.</Text></View> : <>
      {latest && <>
        <View style={styles.mapCard}><MapView style={StyleSheet.absoluteFill} region={mapRegion} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}><Marker coordinate={{ latitude: latest.pickupLat, longitude: latest.pickupLng }} /><Marker coordinate={{ latitude: latest.dropoffLat, longitude: latest.dropoffLng }} /><Polyline coordinates={route.length > 1 ? route : [{ latitude: latest.pickupLat, longitude: latest.pickupLng }, { latitude: latest.dropoffLat, longitude: latest.dropoffLng }]} strokeColor={design.colors.brand} strokeWidth={4} /></MapView></View>
        <View style={styles.latestCard}><Text style={styles.destination}>{latest.dropoffAddress}</Text><Text style={styles.muted}>{formatDate(latest.createdAt)} · {money(latest.estimatedPrice)}</Text><View style={styles.actionRow}><TouchableOpacity style={styles.outlineButton} onPress={() => router.push({ pathname: "/(customer)/rate-trip", params: { tripId: latest.id } })}><Ionicons name="star-outline" size={16} color={design.colors.ink} /><Text style={styles.buttonText}>Rate</Text></TouchableOpacity><TouchableOpacity style={styles.darkButton} onPress={() => rebook(latest)}><Ionicons name="refresh" size={16} color={design.colors.white} /><Text style={styles.darkButtonText}>Rebook</Text></TouchableOpacity></View></View>
      </>}
      <Text style={styles.section}>Previous deliveries</Text>
      {trips.filter((trip) => trip.id !== latest?.id).map((trip) => <View key={trip.id} style={styles.tripRow}><View style={styles.iconCircle}><MaterialCommunityIcons name="truck-fast-outline" size={20} color={design.colors.ink} /></View><View style={styles.tripText}><Text style={styles.tripDestination} numberOfLines={1}>{trip.dropoffAddress.toUpperCase()}</Text><Text style={styles.muted}>{formatDate(trip.createdAt)}</Text><Text style={trip.status === "CANCELLED" ? styles.cancelled : styles.price}>{trip.status === "CANCELLED" ? "Cancelled" : money(trip.estimatedPrice)}</Text></View><TouchableOpacity style={styles.rebook} onPress={() => rebook(trip)}><Text style={styles.buttonText}>Rebook</Text></TouchableOpacity></View>)}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: design.colors.surface, paddingHorizontal: design.spacing.md }, title: { ...design.typography.display, color: design.colors.ink, marginBottom: design.spacing.lg }, loading: { marginTop: design.spacing.xxl }, mapCard: { height: 170, overflow: "hidden", borderRadius: design.radius.lg, marginBottom: design.spacing.md, backgroundColor: design.colors.subtle }, latestCard: { padding: design.spacing.md, borderRadius: design.radius.lg, borderWidth: 1, borderColor: design.colors.border, marginBottom: design.spacing.xl }, destination: { ...design.typography.title, color: design.colors.ink, marginBottom: design.spacing.xs }, muted: { ...design.typography.caption, color: design.colors.muted }, actionRow: { flexDirection: "row", gap: design.spacing.sm, marginTop: design.spacing.md }, outlineButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: design.spacing.xs, borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.pill, paddingHorizontal: design.spacing.md, paddingVertical: design.spacing.sm }, buttonText: { ...design.typography.label, color: design.colors.ink }, darkButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: design.spacing.xs, backgroundColor: design.colors.ink, borderRadius: design.radius.pill, paddingHorizontal: design.spacing.md, paddingVertical: design.spacing.sm }, darkButtonText: { ...design.typography.label, color: design.colors.white }, section: { ...design.typography.heading, color: design.colors.ink, marginBottom: design.spacing.sm }, tripRow: { flexDirection: "row", alignItems: "center", gap: design.spacing.sm, paddingVertical: design.spacing.md, borderBottomWidth: 1, borderBottomColor: design.colors.border }, iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: design.colors.subtle, alignItems: "center", justifyContent: "center" }, tripText: { flex: 1, gap: 2 }, tripDestination: { ...design.typography.label, color: design.colors.ink }, price: { ...design.typography.caption, color: design.colors.success }, cancelled: { ...design.typography.caption, color: design.colors.muted }, rebook: { borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.pill, paddingHorizontal: design.spacing.sm, paddingVertical: design.spacing.xs }, empty: { alignItems: "center", paddingVertical: design.spacing.xxl, gap: design.spacing.sm }, emptyTitle: { ...design.typography.heading, color: design.colors.ink }, link: { ...design.typography.label, color: design.colors.brand } });
