import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";

// Show banner even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission, get an Expo push token, and persist it via PUT /users/me.
 * Safe to call multiple times; no-ops if permission denied or token already saved.
 * Never throws — push is best-effort.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (!Device.isDevice) {
      console.log("[Push] Skipping — not a physical device");
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") {
      console.log("[Push] Permission denied");
      return;
    }

    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
      // Fallback: expo config id, if present
      // @ts-ignore — expo-constants may not be typed here
      undefined;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp.data;
    if (!token) {
      console.log("[Push] No token returned");
      return;
    }

    await apiFetch("/users/me", {
      method: "PUT",
      body: { expoPushToken: token },
    });
    console.log("[Push] Token saved to backend");
  } catch (err) {
    // apiFetch may trigger clearBrokenSession on 401 — that's fine, but never throw.
    console.log("[Push] registerForPushNotificationsAsync failed:", err);
  }
}
