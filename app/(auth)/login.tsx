import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { reconnectSocketWithLatestToken } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const authMode = useAuthStore((state) => state.authMode);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasValidSession = useMemo(() => {
    const hasValidLegacySession = authMode === "legacy" && !!user && !!token;
    const hasValidClerkSession = authMode === "clerk" && !!user;
    return hasValidLegacySession || hasValidClerkSession;
  }, [authMode, token, user]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!hasValidSession) return;

    if (user?.role === "CUSTOMER") {
      router.replace("/(customer)/(tabs)");
      return;
    }

    if (user?.role === "DRIVER") {
      router.replace("/(driver)");
      return;
    }

    if (user?.role === "ADMIN") {
      router.replace("/(admin)");
      return;
    }
  }, [hasHydrated, hasValidSession, user]);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert(
        "Missing details",
        "Enter your username, email or phone and password.",
      );
      return;
    }

    try {
      setLoading(true);

      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: {
          identifier: identifier.trim(),
          password,
        },
      });

      login(data.user, data.token, "legacy");
      reconnectSocketWithLatestToken();

      if (data.user.role === "CUSTOMER") {
        router.replace("/(customer)/(tabs)");
        return;
      }

      if (data.user.role === "DRIVER") {
        router.replace("/(driver)");
        return;
      }

      if (data.user.role === "ADMIN") {
        router.replace("/(admin)");
        return;
      }

      Alert.alert("Unknown role", "This account role is not supported yet.");
    } catch (error: any) {
      console.error("Login failed:", error);
      Alert.alert(
        "Login failed",
        error?.message || "Invalid credentials or server error.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!hasHydrated) {
    return (
      <View style={styles.loaderScreen}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

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
              name="truck-fast-outline"
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.brand}>Safirisha</Text>
          <Text style={styles.heroTitle}>Move goods smarter.</Text>
          <Text style={styles.heroSubtitle}>Anywhere. Anytime.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>
            Sign in with your username, email or phone number.
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#64748b" />
            <TextInput
              style={styles.input}
              placeholder="Username, email or phone"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.eyeButton}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#64748b"
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.link}>
              Don’t have an account?{" "}
              <Text style={styles.linkStrong}>Create one</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: "#020617",
  },
  loaderScreen: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingVertical: 36,
  },
  hero: {
    marginBottom: 22,
  },
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
    marginBottom: 14,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  eyeButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginBottom: 16,
  },
  forgotText: {
    color: "#2563eb",
    fontWeight: "800",
    fontSize: 13,
  },
  button: {
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.92,
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
    color: "#64748b",
    fontWeight: "600",
  },
  linkStrong: {
    color: "#2563eb",
    fontWeight: "800",
  },
});
