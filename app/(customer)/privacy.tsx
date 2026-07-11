import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Privacy & Security</Text>
            <Text style={styles.subtitle}>
              Manage your data and security preferences
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed-outline" size={20} color="#111827" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>Account Security</Text>
              <Text style={styles.infoDesc}>
                Your account is secured with Clerk authentication. All data is
                encrypted in transit.
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#111827" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>Phone Verification</Text>
              <Text style={styles.infoDesc}>
                Your phone number is verified and used for trip updates and
                driver communication.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#111827" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>Location Data</Text>
              <Text style={styles.infoDesc}>
                We use your location only during active trips. Location history
                is not stored.
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="server-outline" size={20} color="#111827" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>Data Storage</Text>
              <Text style={styles.infoDesc}>
                Your trip history and profile data are stored securely on our
                servers. You can request data deletion at any time.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {}}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {}}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 2,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 24,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 16,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
});
