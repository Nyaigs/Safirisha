// SENTRY_INIT_APK
import * as Sentry from "@sentry/react-native";

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import {
  clearCachedClerkToken,
  getBestAccessToken,
  registerClerkTokenGetter,
  setCachedClerkToken,
} from "../lib/auth-token";
import { disconnectSocket, setTokenProvider } from "../lib/socket";
import { setLogoutHandler } from "../lib/api";
import { useAuthStore, setClerkSignOutHandler } from "../store/auth";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import * as Notifications from "expo-notifications";
import { router as expoRouter } from "expo-router";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const authMode = useAuthStore((state) => state.authMode);
  const logout = useAuthStore((state) => state.logout);

  // P1 #15: Dedup — only register push token once per auth session
  const pushRegistrationRef = useRef(false);

  // P1 FIX: Register Clerk signOut so store logout() can call it
  useEffect(() => {
    setClerkSignOutHandler(signOut);
    return () => setClerkSignOutHandler(null);
  }, [signOut]);

  useEffect(() => {
    setTokenProvider(getBestAccessToken);
    setLogoutHandler(logout);

    return () => {
      setTokenProvider(null);
      setLogoutHandler(null);
    };
  }, [logout]);

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

  // H06_PUSH_REGISTRATION_EFFECT — fire once per session, not on every auth re-render
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && !pushRegistrationRef.current) {
      pushRegistrationRef.current = true;
      void registerForPushNotificationsAsync();
    }

    if (!isSignedIn) {
      // Reset on logout so next login registers a fresh token
      pushRegistrationRef.current = false;
    }
  }, [isLoaded, isSignedIn]);

  return null;
}

// H06_PUSH_TAP_LISTENER — deep-link into live-trip when push is tapped
function PushTapListener() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data as
        | { screen?: string; tripId?: string }
        | undefined;
      if (data?.screen === "live-trip" && data.tripId) {
        expoRouter.push({
          pathname: "/(customer)/live-trip",
          params: { tripId: data.tripId },
        });
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <PushTapListener />
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
