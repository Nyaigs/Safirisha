import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
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

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

const VEHICLE_TYPES = [
  "BIKE",
  "TUKTUK",
  "PICKUP",
  "MEDIUM_LORRY",
  "LARGE_TRUCK",
] as const;

export default function DriverKycScreen() {
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] =
    useState<(typeof VEHICLE_TYPES)[number]>("PICKUP");
  const [vehicleImage, setVehicleImage] = useState<PickedImage | null>(null);
  const [ownershipProof, setOwnershipProof] = useState<PickedImage | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const pickImage = async (
    setImage: React.Dispatch<React.SetStateAction<PickedImage | null>>,
    label: string,
  ) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        `Please allow photo library access to upload ${label}.`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const filename = asset.fileName || `${label.replace(/\s+/g, "_")}.jpg`;

    setImage({
      uri: asset.uri,
      name: filename,
      type: asset.mimeType || "image/jpeg",
    });
  };

  const validate = () => {
    if (!plateNumber.trim()) {
      Alert.alert("Missing plate number", "Please enter your plate number.");
      return false;
    }

    if (!vehicleType) {
      Alert.alert("Missing vehicle type", "Please select a vehicle type.");
      return false;
    }

    if (!vehicleImage) {
      Alert.alert("Missing vehicle image", "Please upload a vehicle image.");
      return false;
    }

    if (!ownershipProof) {
      Alert.alert("Missing ownership proof", "Please upload ownership proof.");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("plateNumber", plateNumber.trim().toUpperCase());
      formData.append("vehicleType", vehicleType);

      formData.append("vehicleImage", {
        uri: vehicleImage!.uri,
        name: vehicleImage!.name,
        type: vehicleImage!.type,
      } as any);

      formData.append("ownershipProof", {
        uri: ownershipProof!.uri,
        name: ownershipProof!.name,
        type: ownershipProof!.type,
      } as any);

      await apiFetch("/drivers/me/kyc", {
        method: "PATCH",
        body: formData,
      });

      Alert.alert(
        "KYC submitted",
        "Your verification details have been submitted successfully.",
        [
          {
            text: "Continue",
            onPress: () => router.replace("/(driver)"),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        "KYC submission failed",
        error?.message || "Could not submit verification details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderImagePicker = (
    title: string,
    image: PickedImage | null,
    onPick: () => void,
  ) => (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{title}</Text>
      <Pressable style={styles.uploadButton} onPress={onPick}>
        <Ionicons name="cloud-upload-outline" size={18} color="#334155" />
        <Text style={styles.uploadButtonText}>
          {image ? "Change image" : "Choose image"}
        </Text>
      </Pressable>

      {image ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: image.uri }} style={styles.previewImage} />
          <Text style={styles.previewText} numberOfLines={1}>
            {image.name}
          </Text>
        </View>
      ) : null}
    </View>
  );

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
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.brand}>Safirisha Driver</Text>
          <Text style={styles.heroTitle}>Complete verification</Text>
          <Text style={styles.heroSubtitle}>
            Add your vehicle details and proof documents for admin approval.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Plate Number</Text>
            <TextInput
              value={plateNumber}
              onChangeText={setPlateNumber}
              placeholder="e.g. KDA 123A"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.vehicleTypesWrap}>
              {VEHICLE_TYPES.map((item) => {
                const active = vehicleType === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => setVehicleType(item)}
                    style={[
                      styles.vehicleTypeButton,
                      active && styles.vehicleTypeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.vehicleTypeText,
                        active && styles.vehicleTypeTextActive,
                      ]}
                    >
                      {item.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {renderImagePicker("Vehicle Image", vehicleImage, () =>
            pickImage(setVehicleImage, "vehicle image"),
          )}

          {renderImagePicker("Ownership Proof", ownershipProof, () =>
            pickImage(setOwnershipProof, "ownership proof"),
          )}

          <Pressable
            onPress={handleSubmit}
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
              <Text style={styles.buttonText}>Submit KYC</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.skipButton}
            onPress={() => router.replace("/(driver)")}
            disabled={loading}
          >
            <Text style={styles.skipText}>Skip for now</Text>
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
  vehicleTypesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  vehicleTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  vehicleTypeButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  vehicleTypeText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  vehicleTypeTextActive: {
    color: "#FFFFFF",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  uploadButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  previewCard: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  previewText: {
    color: "#64748b",
    fontSize: 12,
  },
  button: {
    marginTop: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.92 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  skipButton: {
    marginTop: 14,
    alignItems: "center",
  },
  skipText: {
    color: "#2563eb",
    fontWeight: "800",
  },
});
