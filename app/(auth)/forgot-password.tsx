import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!identifier.trim()) {
      Alert.alert(
        "Missing details",
        "Enter your email, username, or phone number first.",
      );
      return;
    }

    try {
      setLoading(true);

      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: {
          identifier: identifier.trim(),
        },
      });

      const devCode = data?.devCode;

      Alert.alert(
        "Reset code sent",
        devCode
          ? `Your test reset code is ${devCode}`
          : "Your reset code has been generated successfully.",
        [
          {
            text: "Continue",
            onPress: () =>
              router.push({
                pathname: "/(auth)/verify-reset-code",
                params: {
                  identifier: identifier.trim(),
                },
              }),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        "Request failed",
        error?.message || "Could not start password recovery.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandBadge}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.brand}>Safirisha</Text>
          <Text style={styles.heroTitle}>Recover your account.</Text>
          <Text style={styles.heroSubtitle}>
            Enter the email, phone number, or username linked to your account.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Forgot password</Text>
          <Text style={styles.cardSubtitle}>
            We’ll use your account details to help you reset your password.
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#64748b" />
            <TextInput
              style={styles.input}
              placeholder="Email, username, or phone"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
            />
          </View>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Back to login</Text>
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
