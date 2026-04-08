import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppLocation, DropoffPlace } from "../types";

const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;

type GeoapifyFeature = {
  properties?: {
    place_id?: string | number;
    formatted?: string;
    address_line1?: string;
    lat?: number | string;
    lon?: number | string;
  };
};

type Props = {
  onSelect: (place: DropoffPlace) => void;
  currentLocation?: AppLocation | null;
};

export default function DropoffSearch({ onSelect, currentLocation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DropoffPlace[]>([]);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (trimmed.length < 3) {
        setResults([]);
        return;
      }

      if (!GEOAPIFY_KEY) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        const biasPart =
          currentLocation?.latitude && currentLocation?.longitude
            ? `&bias=proximity:${currentLocation.longitude},${currentLocation.latitude}`
            : "";

        const url =
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(trimmed)}` +
          `&filter=countrycode:ke&limit=6${biasPart}&apiKey=${GEOAPIFY_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        const places: DropoffPlace[] = (
          (data?.features || []) as GeoapifyFeature[]
        )
          .map((item) => ({
            id: String(item?.properties?.place_id ?? Math.random().toString()),
            name:
              item?.properties?.address_line1 ||
              item?.properties?.formatted ||
              "Unknown location",
            address:
              item?.properties?.formatted ||
              item?.properties?.address_line1 ||
              "Unknown location",
            latitude: Number(item?.properties?.lat),
            longitude: Number(item?.properties?.lon),
          }))
          .filter(
            (item) =>
              !Number.isNaN(item.latitude) && !Number.isNaN(item.longitude),
          );

        setResults(places);
      } catch (error) {
        console.log("Dropoff search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [currentLocation],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchPlaces]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Drop-off Location</Text>

      <TextInput
        style={styles.input}
        placeholder="Search destination..."
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
      />

      {loading && <ActivityIndicator style={styles.loader} />}

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
    color: "#6b7280",
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  loader: {
    marginTop: 10,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  resultsBox: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  lastResultItem: {
    borderBottomWidth: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
});
