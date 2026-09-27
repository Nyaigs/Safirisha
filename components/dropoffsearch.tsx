import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { design } from "../constants/design";
import { AppLocation, DropoffPlace } from "../types";
import { maps } from "../lib/maps";
import { AppInput } from "./ui/app-input";
import { SkeletonBlock } from "./ui/skeleton";

type Props = {
  onSelect: (place: DropoffPlace) => void;
  currentLocation?: AppLocation | null;
  label?: string;
};

export default function DropoffSearch({ onSelect, currentLocation, label = "Search location" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DropoffPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const searchPlaces = useCallback(
    async (text: string) => {
      const requestId = ++requestIdRef.current;
      const trimmed = text.trim();
      setLoading(false);

      if (trimmed.length < 3) {
        setResults([]);
        setError(null);
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
          setResults(places.map((place) => ({
            id: place.id,
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
          })));
        }
      } catch (searchError) {
        if (requestId !== requestIdRef.current) return;
        setError(searchError instanceof Error ? searchError.message : "Place search is unavailable. Please retry.");
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [currentLocation],
  );

  useEffect(() => {
    const requestSequence = requestIdRef;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 400);

    return () => {
      requestSequence.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchPlaces]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <AppInput
        style={styles.input}
        placeholder="Search a landmark, estate or address"
        value={query}
        onChangeText={(text) => {
          requestIdRef.current++;
          setLoading(false);
          setResults([]);
          setError(null);
          setQuery(text);
        }}
        autoCapitalize="words"
      />

      {loading ? (
        <View style={styles.skeletonList} accessibilityLabel="Loading places">
          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.skeletonRow}>
              <SkeletonBlock width={28} height={28} radius={14} />
              <View style={styles.skeletonText}>
                <SkeletonBlock width="60%" height={14} />
                <SkeletonBlock width="90%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && query.trim().length > 0 && query.trim().length < 3 && (
        <Text style={styles.helperText}>
          Type at least 3 characters to search.
        </Text>
      )}

      {results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.resultItem,
                index === results.length - 1 && styles.lastResultItem,
              ]}
              onPress={() => {
                requestIdRef.current++;
                setLoading(false);
                setQuery(item.address);
                setResults([]);
                onSelect(item);
              }}
            >
              <Text style={styles.resultTitle}>
                {item.name || item.address}
              </Text>
              <Text style={styles.resultAddress}>{item.address}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: design.colors.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
  },
  skeletonList: { marginTop: 10, gap: 8 },
  skeletonRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: design.radius.md, backgroundColor: design.colors.surface },
  skeletonText: { flex: 1, gap: 6 },
  errorText: { marginTop: 8, color: design.colors.danger, ...design.typography.caption },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: design.colors.muted,
  },
  resultsBox: {
    marginTop: 8,
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    overflow: "hidden",
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: design.colors.subtle,
  },
  lastResultItem: {
    borderBottomWidth: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: design.colors.ink,
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 13,
    color: design.colors.muted,
    lineHeight: 18,
  },
});
