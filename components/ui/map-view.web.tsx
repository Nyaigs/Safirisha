import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Web placeholder — react-native-maps is not supported on web.
export default function MapView(props: any) {
  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.text}>Map view is not available on the web.</Text>
      <Text style={styles.subtext}>Please use the mobile app to see the map.</Text>
    </View>
  );
}

export const Marker = (_props: any) => null;
export const Polyline = (_props: any) => null;
export const PROVIDER_GOOGLE = null;

// Dummy type — required so imports in shared code compile
export type MapPressEvent = any;

const styles = StyleSheet.create({
  container: { justifyContent: "center", alignItems: "center", backgroundColor: "#E2E8F0" },
  text: { fontSize: 16, fontWeight: "600", color: "#64748B" },
  subtext: { fontSize: 14, color: "#94A3B8", marginTop: 4 },
});
