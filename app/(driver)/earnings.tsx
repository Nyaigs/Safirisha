import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";

type EarningsTrip = {
  id: string;
  estimatedPrice: number;
  driverNetEarning: number;
  platformFeeAmount: number;
  platformFeePercent: number;
  paymentMethod: string | null;
  paymentStatus: string;
  updatedAt: string;
  pickupAddress: string;
  dropoffAddress: string;
};

type EarningsResponse = {
  totals: {
    gross: number;
    net: number;
    fees: number;
    tripCount: number;
  };
  trips: EarningsTrip[];
};

export default function DriverEarningsScreen() {
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const response = await apiFetch("/payments/driver/earnings");
      setData(response as EarningsResponse);
    } catch (error: any) {
      console.log("Failed to load earnings", error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.centerText}>Loading earnings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
          />
        }
      >
        <Text style={styles.title}>Your Earnings</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Gross Collected</Text>
          <Text style={styles.summaryValue}>
            KES {Number(data?.totals.gross || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Safirisha Fees</Text>
          <Text style={styles.summaryValue}>
            KES {Number(data?.totals.fees || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Your Net Earnings</Text>
          <Text style={styles.summaryValue}>
            KES {Number(data?.totals.net || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Completed Paid Trips</Text>
          <Text style={styles.summaryValue}>
            {Number(data?.totals.tripCount || 0).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Recent Earnings</Text>

        {(data?.trips || []).map((trip) => (
          <View key={trip.id} style={styles.tripCard}>
            <Text style={styles.tripFare}>
              Fare: KES {Number(trip.estimatedPrice || 0).toLocaleString()}
            </Text>
            <Text style={styles.tripNet}>
              Net: KES {Number(trip.driverNetEarning || 0).toLocaleString()}
            </Text>
            <Text style={styles.tripMeta}>
              Fee: KES {Number(trip.platformFeeAmount || 0).toLocaleString()} (
              {trip.platformFeePercent}%)
            </Text>
            <Text style={styles.tripMeta}>
              Payment: {trip.paymentMethod || "-"} / {trip.paymentStatus}
            </Text>
            <Text style={styles.tripMeta}>
              {trip.pickupAddress} → {trip.dropoffAddress}
            </Text>
          </View>
        ))}

        {!data?.trips?.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No paid completed trips yet.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 24 },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginTop: 8,
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  summaryLabel: {
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 8,
  },
  summaryValue: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 22,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  tripFare: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
  tripNet: {
    color: "#166534",
    fontWeight: "900",
    marginTop: 6,
  },
  tripMeta: {
    color: "#64748b",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyText: {
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
  },
  center: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: {
    marginTop: 10,
    color: "#64748b",
    fontWeight: "700",
  },
});
