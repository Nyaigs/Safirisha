import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { apiFetch } from "../../lib/api";
import { subscribeToDriverLocationUpdated } from "../../lib/socket";

type LiveDriver = {
  id: string;
  name: string;
  currentLat: number;
  currentLng: number;
  availability?: string | null;
  isActive?: boolean;
  vehicleType?: string | null;
  plateNumber?: string | null;
};

type DriverLocationPayload = {
  id: string;
  name?: string;
  currentLat: number;
  currentLng: number;
  availability?: string;
  vehicleType?: string;
  plateNumber?: string;
};

const NAIROBI_REGION = {
  latitude: -1.2921,
  longitude: 36.8219,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export default function AdminLiveMapScreen() {
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchDrivers = async () => {
      try {
        const res = await apiFetch("/admin/drivers/live");

        if (!isMounted) return;

        setDrivers(Array.isArray(res?.drivers) ? res.drivers : []);
      } catch (error) {
        console.log("Failed to load live drivers:", error);
        if (isMounted) setDrivers([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDrivers();

    const unsubscribe = subscribeToDriverLocationUpdated(
      (payload: DriverLocationPayload) => {
        const lat =
          typeof payload.currentLat === "number" ? payload.currentLat : null;
        const lng =
          typeof payload.currentLng === "number" ? payload.currentLng : null;

        if (lat == null || lng == null) return;

        setDrivers((prev) => {
          const index = prev.findIndex((item) => item.id === payload.id);

          // NEW DRIVER
          if (index === -1) {
            return [
              ...prev,
              {
                id: payload.id,
                name: payload.name || "Driver",
                currentLat: lat,
                currentLng: lng,
                availability: payload.availability || null,
                vehicleType: payload.vehicleType || null,
                plateNumber: payload.plateNumber || null,
              },
            ];
          }

          // UPDATE DRIVER
          const updated = [...prev];

          updated[index] = {
            ...updated[index],
            name: payload.name || updated[index].name,
            currentLat: lat,
            currentLng: lng,
            availability: payload.availability ?? updated[index].availability,
            vehicleType: payload.vehicleType ?? updated[index].vehicleType,
            plateNumber: payload.plateNumber ?? updated[index].plateNumber,
          };

          return updated;
        });
      },
    );

    // ✅ CLEANUP FIX (this is what React expects)
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const onlineDrivers = useMemo(
    () => drivers.filter((driver) => driver.availability === "ONLINE").length,
    [drivers],
  );

  const busyDrivers = useMemo(
    () => drivers.filter((driver) => driver.availability === "BUSY").length,
    [drivers],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading live driver map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={NAIROBI_REGION}>
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.currentLat,
              longitude: driver.currentLng,
            }}
            title={driver.name}
            description={`${driver.vehicleType || "Vehicle"} • ${
              driver.plateNumber || "No plate"
            } • ${driver.availability || "UNKNOWN"}`}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Live Drivers</Text>
        <Text style={styles.overlayText}>
          {drivers.length} on map • {onlineDrivers} online • {busyDrivers} busy
        </Text>
      </View>

      {drivers.length === 0 ? (
        <View style={styles.emptyFloat}>
          <Text style={styles.emptyFloatTitle}>No live drivers right now</Text>
          <Text style={styles.emptyFloatText}>
            Drivers will appear here once they go online and share location.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    color: "#475569",
    fontWeight: "600",
  },

  overlay: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderRadius: 18,
    padding: 14,
  },

  overlayTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  overlayText: {
    color: "#cbd5e1",
    marginTop: 4,
    fontWeight: "600",
  },

  emptyFloat: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  emptyFloatTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },

  emptyFloatText: {
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },
});
