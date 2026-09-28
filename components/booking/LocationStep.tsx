import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { design } from "../../constants/design";
import { SkeletonBlock } from "../ui/skeleton";
import { AppLocation } from "../../types";

type Props = {
  kind: "pickup" | "dropoff";
  currentLocation: AppLocation | null;
  loadingLocation: boolean;
  onCurrent: () => void;
  onOpenSearch: () => void;
  onMapPick: () => void;
};

export function LocationStep({ kind, currentLocation, loadingLocation, onCurrent, onOpenSearch, onMapPick }: Props) {
  const label = kind === "pickup" ? "pickup" : "drop-off";
  return (
    <View>
      <Text style={styles.title}>Set {label} location</Text>
      <Text style={styles.subtitle}>Use GPS, search a landmark or estate, or place a pin on the map.</Text>

      <TouchableOpacity style={styles.action} onPress={onCurrent} disabled={loadingLocation}>
        {loadingLocation ? <SkeletonBlock width={20} height={20} radius={10} /> : <Ionicons name="locate-outline" size={20} color={design.colors.brand} />}
        <View>
          <Text style={styles.actionTitle}>Use current location</Text>
          <Text style={styles.actionMeta}>{currentLocation?.address || "Get your GPS location"}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.searchBox} onPress={onOpenSearch}>
        <Ionicons name="search-outline" size={20} color={design.colors.muted} />
        <Text style={styles.searchBoxText}>Search a landmark, estate or address</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.mapAction} onPress={onMapPick}>
        <Ionicons name="map-outline" size={20} color={design.colors.brand} />
        <Text style={styles.mapActionText}>Pick a point on the map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...design.typography.title, color: design.colors.ink },
  subtitle: { ...design.typography.body, color: design.colors.muted, marginTop: 4, marginBottom: design.spacing.md },
  action: { flexDirection: "row", gap: design.spacing.sm, alignItems: "center", padding: design.spacing.md, borderRadius: design.radius.md, backgroundColor: design.colors.brandSoft, marginBottom: design.spacing.sm },
  actionTitle: { ...design.typography.label, color: design.colors.ink },
  actionMeta: { ...design.typography.caption, color: design.colors.muted, marginTop: 2, maxWidth: 270 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: design.spacing.sm, paddingHorizontal: design.spacing.md, paddingVertical: 14, borderRadius: design.radius.md, borderWidth: 1, borderColor: design.colors.border, backgroundColor: design.colors.surface, marginBottom: design.spacing.sm },
  searchBoxText: { ...design.typography.body, color: design.colors.muted },
  mapAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: design.spacing.xs, paddingVertical: design.spacing.md },
  mapActionText: { ...design.typography.label, color: design.colors.brand },
});
