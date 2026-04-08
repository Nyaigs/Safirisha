import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
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
import { reconnectSocketWithLatestToken } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";

type PublicRole = "CUSTOMER" | "DRIVER";

export default function RegisterScreen() {
  const login = useAuthStore((state) => state.login);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PublicRole>("CUSTOMER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!fullName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return false;
    }

    if (!username.trim()) {
      Alert.alert("Missing username", "Please choose a username.");
      return false;
    }

    const usernameRegex = /^[a-zA-Z0-9_.]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      Alert.alert(
        "Invalid username",
        "Username must be 3-20 characters and only use letters, numbers, underscore or dot.",
      );
      return false;
    }

    if (!phone.trim()) {
      Alert.alert("Missing phone", "Please enter your phone number.");
      return false;
    }

    if (!email.trim()) {
      Alert.alert("Missing email", "Please enter your email address.");
      return false;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return false;
    }

    if (!password) {
      Alert.alert("Missing password", "Please create a password.");
      return false;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak password",
        "Password must be at least 6 characters long.",
      );
      return false;
    }

    if (!confirmPassword) {
      Alert.alert("Missing confirmation", "Please confirm your password.");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const endpoint =
        role === "CUSTOMER"
          ? "/auth/register/customer"
          : "/auth/register/driver";

      const data = await apiFetch(endpoint, {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
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
        Alert.alert(
          "Driver account created",
          "Your account has been created. Next, complete your vehicle verification details.",
          [
            {
              text: "Continue",
              onPress: () => router.replace("../(driver)/kyc"),
            },
          ],
        );
        return;
      }

      if (data.user.role === "ADMIN") {
        router.replace("/(admin)");
        return;
      }

      router.replace("/(auth)/login");
    } catch (error: any) {
      console.error("Register error:", error);
      Alert.alert(
        "Registration failed",
        error?.message || "Something went wrong. Try again.",
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
              name="truck-fast-outline"
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.brand}>Safirisha</Text>
          <Text style={styles.heroTitle}>Create your account.</Text>
          <Text style={styles.heroSubtitle}>
            Legacy signup remains active while Clerk is being phased in.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardSubtitle}>
            Create your account first. Driver verification comes next after
            signup.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. nyaigs.dev"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 0712345678"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.roleRow}>
              <Pressable
                onPress={() => setRole("CUSTOMER")}
                style={[
                  styles.roleButton,
                  role === "CUSTOMER" && styles.roleButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === "CUSTOMER" && styles.roleButtonTextActive,
                  ]}
                >
                  Customer
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRole("DRIVER")}
                style={[
                  styles.roleButton,
                  role === "DRIVER" && styles.roleButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === "DRIVER" && styles.roleButtonTextActive,
                  ]}
                >
                  Driver
                </Text>
              </Pressable>
            </View>
          </View>

          {role === "DRIVER" ? (
            <View style={styles.driverHint}>
              <Text style={styles.driverHintTitle}>
                Driver verification comes next
              </Text>
              <Text style={styles.driverHintText}>
                After creating your driver account, you’ll add your plate
                number, vehicle type, vehicle image, and ownership proof in the
                KYC step.
              </Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor="#94A3B8"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#64748b"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor="#94A3B8"
                style={styles.passwordInput}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                style={styles.eyeButton}
                hitSlop={10}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#64748b"
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleRegister}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.linkText}>
              Sign in
            </Link>
          </View>
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
    marginBottom: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#334155",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#0f172a",
    fontSize: 15,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    color: "#0f172a",
    fontSize: 15,
  },
  eyeButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  roleButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  driverHint: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  driverHintTitle: {
    color: "#1d4ed8",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 6,
  },
  driverHintText: {
    color: "#334155",
    lineHeight: 20,
  },
  button: {
    marginTop: 10,
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  footerRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  linkText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
});
