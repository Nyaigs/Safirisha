import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smsUpdates, setSmsUpdates] = useState(false);

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear locally stored data. You will need to log in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            Alert.alert("Done", "Cache cleared successfully.");
          },
        },
      ],
    );
  };

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
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>App preferences and options</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#111827" />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#e5e7eb", true: "#111827" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="chatbubble-outline" size={20} color="#111827" />
              <Text style={styles.settingText}>SMS Updates</Text>
            </View>
            <Switch
              value={smsUpdates}
              onValueChange={setSmsUpdates}
              trackColor={{ false: "#e5e7eb", true: "#111827" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() =>
              Alert.alert(
                "Contact Support",
                "Reach us at support@safirisha.com or call +254 700 000 000",
              )
            }
          >
            <View style={styles.settingLeft}>
              <Ionicons name="call-outline" size={20} color="#111827" />
              <Text style={styles.settingText}>Contact Us</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() =>
              Alert.alert("FAQ", "Frequently asked questions coming soon.")
            }
          >
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#111827" />
              <Text style={styles.settingText}>FAQ</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleClearCache}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
              <Text style={[styles.settingText, { color: "#dc2626" }]}>
                Clear Cache
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Safirisha v1.0.0</Text>
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 16,
  },
  versionText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 8,
  },
});
