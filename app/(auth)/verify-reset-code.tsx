import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { apiFetch } from "../../lib/api";

export default function VerifyResetCodeScreen() {
  const { identifier } = useLocalSearchParams<{ identifier?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const safeIdentifier = String(identifier || "").trim();

  const handleVerify = async () => {
    if (!safeIdentifier) {
      Alert.alert("Missing identifier", "Restart the password reset flow.");
      return;
    }

    if (!code.trim()) {
      Alert.alert("Missing code", "Enter the reset code first.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch("/auth/verify-reset-code", {
        method: "POST",
        body: {
          identifier: safeIdentifier,
          code: code.trim(),
        },
      });

      Alert.alert("Code verified", "You can now set a new password.", [
        {
          text: "Continue",
          onPress: () =>
            router.push({
              pathname: "/(auth)/reset-password",
              params: {
                identifier: safeIdentifier,
                code: code.trim(),
              },
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Verification failed",
        error?.message || "Could not verify reset code.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandBadge}>
            <MaterialCommunityIcons name="key-outline" size={24} color="#fff" />
          </View>
          <Text style={styles.brand}>Safirisha</Text>
          <Text style={styles.heroTitle}>Verify reset code</Text>
          <Text style={styles.heroSubtitle}>
            Enter the code generated for your account.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification</Text>
          <Text style={styles.cardSubtitle}>
            Account: {safeIdentifier || "Not provided"}
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify Code</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: "#020617" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingVertical: 36,
  },
  hero: { marginBottom: 22 },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brand: {
    color: "#60a5fa",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 18,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  button: {
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  link: {
    marginTop: 18,
    textAlign: "center",
    color: "#2563eb",
    fontWeight: "800",
  },
});
