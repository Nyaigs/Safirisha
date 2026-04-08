import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";

type Role = "CUSTOMER" | "DRIVER" | "ADMIN";

const ROLE_META: Record<
  Role,
  {
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    helper: string;
  }
> = {
  CUSTOMER: {
    title: "Customer",
    subtitle: "Standard client account",
    icon: "person-outline",
    accent: "#2563eb",
    helper: "Can request transport and manage deliveries.",
  },
  DRIVER: {
    title: "Driver",
    subtitle: "Transport provider account",
    icon: "car-outline",
    accent: "#16a34a",
    helper: "Can receive jobs, go online, and complete trips.",
  },
  ADMIN: {
    title: "Admin",
    subtitle: "Management access account",
    icon: "shield-checkmark-outline",
    accent: "#7c3aed",
    helper: "Can monitor users, trips, and platform activity.",
  },
};

export default function CreateUserScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CUSTOMER");

  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const isDriver = useMemo(() => role === "DRIVER", [role]);
  const selectedRoleMeta = ROLE_META[role];

  const passwordStrength = useMemo(() => {
    const value = password.trim();
    if (!value) {
      return { label: "No password yet", score: 0 };
    }
    if (value.length < 6) {
      return { label: "Weak", score: 1 };
    }
    if (value.length < 10) {
      return { label: "Fair", score: 2 };
    }
    return { label: "Strong", score: 3 };
  }, [password]);

  const clearForm = () => {
    setFullName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("CUSTOMER");
    setPlateNumber("");
    setVehicleType("");
    setShowPassword(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    clearForm();
    setRefreshing(false);
  };

  const validate = () => {
    if (!fullName.trim()) return "Full name is required";
    if (!username.trim()) return "Username is required";
    if (!email.trim()) return "Email is required";
    if (!phone.trim()) return "Phone is required";
    if (!password.trim()) return "Password is required";
    if (password.trim().length < 6) {
      return "Password must be at least 6 characters";
    }

    if (isDriver) {
      if (!plateNumber.trim()) return "Plate number is required for drivers";
      if (!vehicleType.trim()) return "Vehicle type is required for drivers";
    }

    return null;
  };

  const handleCreateUser = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Validation Error", error);
      return;
    }

    try {
      setLoading(true);

      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: password.trim(),
          role,
          ...(isDriver
            ? {
                plateNumber: plateNumber.trim().toUpperCase(),
                vehicleType: vehicleType.trim(),
              }
            : {}),
        }),
      });

      Alert.alert("Success", "User created successfully", [
        {
          text: "Open Users",
          onPress: () => router.replace("/(admin)/users"),
        },
      ]);
    } catch (err: any) {
      console.log("Create user failed:", err);
      Alert.alert("Error", err?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create New User</Text>
            <Text style={styles.headerSubtitle}>Premium admin onboarding</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="person-add-outline" size={28} color="#fff" />
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>
                Add a customer, driver, or admin from one polished control flow.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.rolePreview,
              { borderColor: selectedRoleMeta.accent + "33" },
            ]}
          >
            <View
              style={[
                styles.rolePreviewIcon,
                { backgroundColor: selectedRoleMeta.accent + "18" },
              ]}
            >
              <Ionicons
                name={selectedRoleMeta.icon}
                size={20}
                color={selectedRoleMeta.accent}
              />
            </View>

            <View style={styles.rolePreviewTextWrap}>
              <Text style={styles.rolePreviewTitle}>
                {selectedRoleMeta.title} selected
              </Text>
              <Text style={styles.rolePreviewText}>
                {selectedRoleMeta.helper}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choose Role</Text>
        <View style={styles.roleGrid}>
          <RoleCard
            title="Customer"
            subtitle="Standard client account"
            icon="person-outline"
            selected={role === "CUSTOMER"}
            onPress={() => setRole("CUSTOMER")}
          />
          <RoleCard
            title="Driver"
            subtitle="Transport provider account"
            icon="car-outline"
            selected={role === "DRIVER"}
            onPress={() => setRole("DRIVER")}
          />
          <RoleCard
            title="Admin"
            subtitle="Management access account"
            icon="shield-checkmark-outline"
            selected={role === "ADMIN"}
            onPress={() => setRole("ADMIN")}
          />
        </View>

        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Basic Details</Text>
            <Text style={styles.cardSubtitle}>
              Required identity and login information
            </Text>
          </View>

          <Input
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
            autoCapitalize="words"
          />

          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username"
            autoCapitalize="none"
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordMetaRow}>
              <Text style={styles.passwordHint}>Minimum 6 characters</Text>
              <Text style={styles.passwordStrength}>
                {passwordStrength.label}
              </Text>
            </View>

            <View style={styles.passwordBars}>
              <View
                style={[
                  styles.passwordBar,
                  passwordStrength.score >= 1 && styles.passwordBarActive,
                ]}
              />
              <View
                style={[
                  styles.passwordBar,
                  passwordStrength.score >= 2 && styles.passwordBarActive,
                ]}
              />
              <View
                style={[
                  styles.passwordBar,
                  passwordStrength.score >= 3 && styles.passwordBarActive,
                ]}
              />
            </View>
          </View>
        </View>

        {isDriver ? (
          <View style={styles.driverSection}>
            <View style={styles.driverHeader}>
              <View style={styles.driverIconWrap}>
                <MaterialCommunityIcons
                  name="truck-outline"
                  size={22}
                  color="#166534"
                />
              </View>
              <View style={styles.driverHeaderText}>
                <Text style={styles.driverTitle}>Driver Details</Text>
                <Text style={styles.driverSubtitle}>
                  Required for driver onboarding and trip assignment
                </Text>
              </View>
            </View>

            <Input
              label="Plate Number"
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
              placeholder="e.g. KDA 123A"
            />

            <Input
              label="Vehicle Type"
              value={vehicleType}
              onChangeText={setVehicleType}
              placeholder="e.g. Pickup, TukTuk, Lorry"
            />
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={clearForm}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={18} color="#0f172a" />
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreateUser}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.buttonText}>Create User</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, selected && styles.roleCardActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View
        style={[styles.roleIconWrap, selected && styles.roleIconWrapActive]}
      >
        <Ionicons name={icon} size={22} color={selected ? "#fff" : "#0f172a"} />
      </View>

      <Text style={[styles.roleTitle, selected && styles.roleTitleActive]}>
        {title}
      </Text>

      <Text
        style={[styles.roleSubtitle, selected && styles.roleSubtitleActive]}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function Input({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingBottom: 40,
  },

  header: {
    backgroundColor: "#0b1220",
    paddingTop: 62,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#182235",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "700",
    fontSize: 12,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    margin: 16,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  heroContent: {
    flex: 1,
  },
  heading: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
  subheading: {
    marginTop: 6,
    color: "#64748b",
    lineHeight: 20,
  },
  rolePreview: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  rolePreviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rolePreviewTextWrap: {
    flex: 1,
  },
  rolePreviewTitle: {
    fontWeight: "900",
    color: "#111827",
    fontSize: 14,
  },
  rolePreviewText: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
    marginHorizontal: 16,
  },

  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  roleCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    minHeight: 140,
  },
  roleCardActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  roleIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  roleTitleActive: {
    color: "#fff",
  },
  roleSubtitle: {
    color: "#64748b",
    lineHeight: 18,
    fontSize: 12,
    fontWeight: "700",
  },
  roleSubtitleActive: {
    color: "#d1d5db",
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  cardSubtitle: {
    color: "#64748b",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 13,
  },

  inputGroup: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontWeight: "800",
    color: "#0f172a",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    color: "#0f172a",
  },

  passwordWrap: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    color: "#0f172a",
  },
  passwordMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  passwordHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  passwordStrength: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  passwordBars: {
    flexDirection: "row",
    marginTop: 8,
  },
  passwordBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    marginRight: 6,
  },
  passwordBarActive: {
    backgroundColor: "#0F172A",
  },

  driverSection: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginHorizontal: 16,
    marginBottom: 18,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  driverIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  driverHeaderText: {
    flex: 1,
  },
  driverTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  driverSubtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },

  actionsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginRight: 10,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 15,
    marginLeft: 8,
  },
  button: {
    flex: 1.4,
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    marginLeft: 8,
  },
});
