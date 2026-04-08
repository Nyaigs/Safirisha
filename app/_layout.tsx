import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  clearCachedClerkToken,
  registerClerkTokenGetter,
  setCachedClerkToken,
} from "../lib/auth-token";
import { disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/auth";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const authMode = useAuthStore((state) => state.authMode);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    registerClerkTokenGetter(async () => {
      if (!isLoaded || !isSignedIn) return null;

      try {
        const token = await getToken();
        setCachedClerkToken(token ?? null);
        return token ?? null;
      } catch (error) {
        console.log("Clerk getToken failed:", error);
        return null;
      }
    });

    return () => {
      registerClerkTokenGetter(null);
      clearCachedClerkToken();
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    let cancelled = false;

    async function syncToken() {
      if (!isLoaded || !isSignedIn) {
        clearCachedClerkToken();
        return;
      }

      try {
        const token = await getToken();
        if (!cancelled) {
          setCachedClerkToken(token ?? null);
        }
      } catch (error) {
        console.log("Failed to sync Clerk token:", error);
      }
    }

    syncToken();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn && authMode === "clerk") {
      disconnectSocket();
      logout();
      clearCachedClerkToken();
    }
  }, [authMode, isLoaded, isSignedIn, logout]);

  return null;
}

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(driver)" />
    </Stack>
  );
}

export default function RootLayout() {
  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your frontend .env",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkTokenBridge />
      <RootNavigator />
    </ClerkProvider>
  );
}
