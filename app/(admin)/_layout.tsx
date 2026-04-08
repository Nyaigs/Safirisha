import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack, router } from "expo-router";
import { ActivityIndicator, Alert, TouchableOpacity, View } from "react-native";
import { disconnectSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/auth";

export default function AdminLayout() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const handleLogout = () => {
    Alert.alert("Log out", "Do you want to log out of the admin account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          disconnectSocket();
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f3f4f6",
        }}
      >
        <ActivityIndicator size="large" color="#0b1220" />
      </View>
    );
  }

  if (!token || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role !== "ADMIN") {
    if (user.role === "CUSTOMER") {
      return <Redirect href="/(customer)/(tabs)" />;
    }

    if (user.role === "DRIVER") {
      return <Redirect href="/(driver)" />;
    }

    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0b1220" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#f3f4f6" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen name="users" options={{ title: "Users Center" }} />
      <Stack.Screen name="create-user" options={{ title: "Create User" }} />
      <Stack.Screen name="user-details" options={{ title: "User Details" }} />

      <Stack.Screen name="trips" options={{ title: "Trips & Requests" }} />
      <Stack.Screen name="trip-details" options={{ title: "Trip Details" }} />

      <Stack.Screen
        name="pending-drivers"
        options={{ title: "Pending Drivers" }}
      />
      <Stack.Screen
        name="deletion-requests"
        options={{ title: "Deletion Requests" }}
      />
      <Stack.Screen name="live-map" options={{ title: "Live Map" }} />

      <Stack.Screen
        name="profile"
        options={{
          title: "Settings",
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 6 }}>
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen
        name="change-password"
        options={{ title: "Change Password" }}
      />
    </Stack>
  );
}
