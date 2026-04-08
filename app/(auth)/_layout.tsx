import { Redirect, Stack } from "expo-router";
import { useMemo } from "react";
import { useAuthStore } from "../../store/auth";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const authMode = useAuthStore((state) => state.authMode);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const hasValidSession = useMemo(() => {
    const hasValidLegacySession = authMode === "legacy" && !!user && !!token;
    const hasValidClerkSession = authMode === "clerk" && !!user;
    return hasValidLegacySession || hasValidClerkSession;
  }, [authMode, token, user]);

  if (!hasHydrated) {
    return null;
  }

  if (hasValidSession) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#020617" },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-reset-code" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
