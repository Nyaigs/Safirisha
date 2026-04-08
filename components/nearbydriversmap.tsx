import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { connectSocket } from "../lib/socket";
import { isValidCoordinate } from "../utils/validators";

type Driver = {
  id: string;
  latitude: number;
  longitude: number;
};

type Props = {
  pickupLat: number;
  pickupLng: number;
  tripId?: string;
};

type DriverLocationPayload = {
  tripId: string;
  driverId: string;
  latitude: number;
  longitude: number;
};

export default function NearbyDriversMap({
  pickupLat,
  pickupLng,
  tripId,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([
    {
      id: "d1",
      latitude: pickupLat + 0.002,
      longitude: pickupLng + 0.002,
    },
    {
      id: "d2",
      latitude: pickupLat - 0.002,
      longitude: pickupLng - 0.001,
    },
  ]);

  const initialRegion = useMemo(
    () => ({
      latitude: pickupLat,
      longitude: pickupLng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [pickupLat, pickupLng],
  );

  useEffect(() => {
    if (!tripId) return;

    const socket = connectSocket();

    const handleDriverLocation = (payload: DriverLocationPayload) => {
      if (payload.tripId !== tripId) return;

      if (
        !isValidCoordinate(payload.latitude) ||
        !isValidCoordinate(payload.longitude)
      ) {
        return;
      }

      setDrivers((prev) => {
        const existingIndex = prev.findIndex((d) => d.id === payload.driverId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            latitude: payload.latitude,
            longitude: payload.longitude,
          };
          return updated;
        }

        return [
          ...prev,
          {
            id: payload.driverId,
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
        ];
      });

      mapRef.current?.animateToRegion(
        {
          latitude: payload.latitude,
          longitude: payload.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600,
      );
    };

    socket.on("trip:driver-location", handleDriverLocation);

    return () => {
      socket.off("trip:driver-location", handleDriverLocation);
    };
  }, [tripId]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
      >
        <Marker
          coordinate={{
            latitude: pickupLat,
            longitude: pickupLng,
          }}
          title="Pickup Location"
        />

        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.latitude,
              longitude: driver.longitude,
            }}
            title="Driver"
            pinColor="green"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 250,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
});
