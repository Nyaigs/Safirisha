import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { maps } from "../../lib/maps";
import { AppLocation, DropoffPlace } from "../../types";

type SearchResult = DropoffPlace & { distanceKm?: number };

type Props = {
  visible: boolean;
  initialField: "pickup" | "dropoff";
  initialQuery?: string;
  pickup: AppLocation | null;
  dropoff: AppLocation | null;
  currentLocation: AppLocation | null;
  onClose: () => void;
  onSelectPickup: (place: AppLocation) => void;
  onSelectDropoff: (place: AppLocation) => void;
  onUseCurrentLocation: () => Promise<AppLocation | null>;
  onPickOnMap: (kind: "pickup" | "dropoff") => void;
};

const QUICK_PLACES = [
  { label: "Add Home", icon: "home-outline" as const },
  { label: "Add Work", icon: "briefcase-outline" as const },
  { label: "Saved places", icon: "star-outline" as const },
];

export function LocationSearchOverlay({
  visible,
  initialField,
  initialQuery = "",
  pickup,
  dropoff,
  currentLocation,
  onClose,
  onSelectPickup,
  onSelectDropoff,
  onUseCurrentLocation,
  onPickOnMap,
}: Props) {
  const insets = useSafeAreaInsets();
  const [activeField, setActiveField] = useState<"pickup" | "dropoff">(initialField);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setActiveField(initialField);
      setPickupQuery(initialField === "pickup" ? initialQuery : "");
      setDropoffQuery(initialField === "dropoff" ? initialQuery : "");
      setResults([]);
      setError(null);
    }
  }, [visible, initialField, initialQuery]);

  const activeQuery = activeField === "pickup" ? pickupQuery : dropoffQuery;

  const searchPlaces = useCallback(
    async (text: string) => {
      const requestId = ++requestIdRef.current;
      const trimmed = text.trim();
      if (trimmed.length < 3) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const places = await maps.searchPlaces(
          trimmed,
          currentLocation
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
        );
        if (requestId === requestIdRef.current) {
          // Dedupe by id — Geoapify sometimes returns the same place twice
          const seen = new Set<string>();
          const deduped: SearchResult[] = [];
          for (const place of places) {
            if (seen.has(place.id)) continue;
            seen.add(place.id);
            deduped.push({
              id: place.id,
              name: place.name,
              address: place.address,
              latitude: place.latitude,
              longitude: place.longitude,
              distanceKm: place.distanceKm,
            });
          }
          setResults(deduped);
        }
      } catch (searchError) {
        if (requestId !== requestIdRef.current) return;
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Place search is unavailable. Please retry.",
        );
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [currentLocation],
  );

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(activeQuery), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeQuery, searchPlaces, visible]);

  const handleSelect = (place: SearchResult) => {
    const point: AppLocation = { ...place, placeId: place.id };
    // Close modal FIRST so its dismissal animation plays before the
    // sheet behind it advances to the next step. Prevents the flash.
    onClose();
    setTimeout(() => {
      if (activeField === "pickup") onSelectPickup(point);
      else onSelectDropoff(point);
    }, 260);
  };

  const handleCurrentLocation = async () => {
    const point = await onUseCurrentLocation();
    if (!point) return;
    onClose();
    setTimeout(() => {
      if (activeField === "pickup") onSelectPickup(point);
      else onSelectDropoff(point);
    }, 260);
  };

  const handlePickOnMap = () => {
    onClose();
    onPickOnMap(activeField);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 8 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={design.colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan your delivery</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Top chips */}
        <View style={styles.topChips}>
          <View style={styles.chip}>
            <Ionicons name="time-outline" size={14} color={design.colors.ink} />
            <Text style={styles.chipText}>Pickup now</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="person-outline" size={14} color={design.colors.ink} />
            <Text style={styles.chipText}>For me</Text>
          </View>
        </View>

        {/* Bolt-style location card */}
        <View style={styles.cardRow}>
          <View style={styles.card}>
            {/* Pickup row */}
            <View style={styles.cardRowInner}>
              <View style={styles.markerCol}>
                <View style={styles.pickupDot} />
                <View style={styles.connector} />
                <View style={styles.dropoffSquare} />
              </View>
              <View style={styles.inputsCol}>
                <TextInput
                  value={pickupQuery}
                  onChangeText={(text) => {
                    setActiveField("pickup");
                    setPickupQuery(text);
                  }}
                  onFocus={() => setActiveField("pickup")}
                  placeholder={pickup?.address || "Pickup location"}
                  placeholderTextColor={design.colors.muted}
                  style={styles.cardInput}
                />
                <View style={styles.inputDivider} />
                <TextInput
                  value={dropoffQuery}
                  onChangeText={(text) => {
                    setActiveField("dropoff");
                    setDropoffQuery(text);
                  }}
                  onFocus={() => setActiveField("dropoff")}
                  placeholder={dropoff?.address || "Where to?"}
                  placeholderTextColor={design.colors.muted}
                  style={styles.cardInput}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="add" size={22} color={design.colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Quick chips */}
        <View style={styles.quickRow}>
          {QUICK_PLACES.map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickChip}>
              <Ionicons name={item.icon} size={16} color={design.colors.brand} />
              <Text style={styles.quickChipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shortcuts */}
        <TouchableOpacity style={styles.shortcut} onPress={handleCurrentLocation}>
          <Ionicons name="locate-outline" size={18} color={design.colors.brand} />
          <Text style={styles.shortcutText}>Use current location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcut} onPress={handlePickOnMap}>
          <Ionicons name="map-outline" size={18} color={design.colors.brand} />
          <Text style={styles.shortcutText}>Pick on map</Text>
        </TouchableOpacity>

        {/* Results */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
        >
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={design.colors.brand} />
            </View>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && activeQuery.trim().length > 0 && activeQuery.trim().length < 3 && (
            <Text style={styles.helperText}>Type at least 3 characters to search.</Text>
          )}
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultRow}
              onPress={() => handleSelect(item)}
            >
              <View style={styles.resultLeft}>
                <View style={styles.resultIcon}>
                  <Ionicons name="time-outline" size={16} color={design.colors.muted} />
                </View>
                {typeof item.distanceKm === "number" && (
                  <Text style={styles.resultDistance}>{item.distanceKm.toFixed(1)} km</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>{item.name || item.address}</Text>
                <Text style={styles.resultAddress} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: design.spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: design.spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...design.typography.title, color: design.colors.ink },

  topChips: { flexDirection: "row", gap: design.spacing.xs, marginBottom: design.spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: design.radius.pill,
    backgroundColor: design.colors.subtle,
  },
  chipText: { ...design.typography.caption, color: design.colors.ink, fontWeight: "600" },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    marginBottom: design.spacing.md,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderColor: design.colors.ink,
    borderRadius: design.radius.lg,
    paddingVertical: 4,
    paddingHorizontal: design.spacing.sm,
  },
  cardRowInner: { flexDirection: "row", alignItems: "stretch" },
  markerCol: {
    width: 24,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 14,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: design.colors.brand,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: design.colors.ink,
    marginVertical: 2,
  },
  dropoffSquare: {
    width: 12,
    height: 12,
    backgroundColor: design.colors.ink,
    borderRadius: 2,
  },
  inputsCol: { flex: 1 },
  cardInput: {
    ...design.typography.body,
    color: design.colors.ink,
    paddingVertical: 14,
  },
  inputDivider: { height: 1, backgroundColor: design.colors.border },

  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: design.colors.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  quickRow: { flexDirection: "row", gap: design.spacing.xs, marginBottom: design.spacing.md },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "#fff",
  },
  quickChipText: { ...design.typography.caption, color: design.colors.ink, fontWeight: "600" },

  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    paddingVertical: 12,
  },
  shortcutText: { ...design.typography.label, color: design.colors.brand },

  resultsScroll: { flex: 1, marginTop: design.spacing.sm },
  resultsContent: { paddingBottom: design.spacing.lg },
  loadingRow: { paddingVertical: design.spacing.md, alignItems: "center" },
  errorText: { ...design.typography.caption, color: design.colors.danger, paddingVertical: design.spacing.sm },
  helperText: { ...design.typography.caption, color: design.colors.muted, paddingVertical: design.spacing.sm },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: design.colors.subtle,
  },
  resultLeft: { alignItems: "center", width: 50, gap: 4 },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: design.colors.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  resultDistance: { ...design.typography.caption, color: design.colors.muted, fontSize: 11 },
  resultTitle: { ...design.typography.label, color: design.colors.ink, marginBottom: 2 },
  resultAddress: { ...design.typography.caption, color: design.colors.muted },
});
