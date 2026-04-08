import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { apiFetch } from "../lib/api";
import { reconnectSocketWithLatestToken } from "../lib/socket";
import { useAuthStore } from "../store/auth";

export default function AppEntryScreen() {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const authMode = useAuthStore((state) => state.authMode);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapChecked, setBootstrapChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapClerkUser() {
      if (!hasHydrated || !clerkLoaded) return;

      if (user) {
        setBootstrapChecked(true);
        return;
      }

      if (!isSignedIn) {
        setBootstrapChecked(true);
        return;
      }

      try {
        setBootstrapping(true);

        const res = await apiFetch("/auth/clerk/bootstrap", {
          method: "POST",
          body: {},
        });

        if (cancelled) return;

        login(res.user, null, "clerk");
        reconnectSocketWithLatestToken();
      } catch (error) {
        console.log("Clerk bootstrap failed:", error);
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
          setBootstrapChecked(true);
        }
      }
    }

    bootstrapClerkUser();

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, hasHydrated, isSignedIn, login, logout, user]);

  if (!hasHydrated || !clerkLoaded || bootstrapping || !bootstrapChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (authMode === "legacy" && !token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role === "ADMIN") {
    return <Redirect href="/(admin)" />;
  }

  if (user.role === "DRIVER") {
    return <Redirect href="/(driver)" />;
  }

  if (user.role === "CUSTOMER") {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
