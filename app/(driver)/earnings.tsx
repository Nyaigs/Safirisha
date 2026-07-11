import { useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEarningsStore } from "../../store/earnings";

export default function DriverEarningsScreen() {
  const totals = useEarningsStore((s) => s.totals);
  const trips = useEarningsStore((s) => s.trips);
  const isLoading = useEarningsStore((s) => s.isLoading);
  const isRefreshing = useEarningsStore((s) => s.isRefreshing);
  const fetchEarnings = useEarningsStore((s) => s.fetchEarnings);

  useEffect(() => {
    fetchEarnings("initial");
  }, [fetchEarnings]);

  if (isLoading) {
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
            refreshing={isRefreshing}
            onRefresh={() => fetchEarnings("refresh")}
          />
        }
      >
        <Text style={styles.title}>Your Earnings</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Gross Collected</Text>
          <Text style={styles.summaryValue}>
            KES {Number(totals.gross || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Safirisha Fees</Text>
          <Text style={styles.summaryValue}>
            KES {Number(totals.fees || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Your Net Earnings</Text>
          <Text style={styles.summaryValue}>
            KES {Number(totals.net || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Completed Paid Trips</Text>
          <Text style={styles.summaryValue}>
            {Number(totals.tripCount || 0).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Recent Earnings</Text>

        {trips.map((trip) => (
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

        {!trips.length ? (
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
