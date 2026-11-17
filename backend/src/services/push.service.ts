/**
 * Sends a push notification to a specific Expo push token.
 * Uses dynamic import to support the ESM-only expo-server-sdk in a CommonJS project.
 */
export async function sendPushNotification(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (!token) {
    console.log(`[Push] Missing Expo token`);
    return;
  }

  try {
    // Dynamically import the ESM package
    const { Expo } = await import("expo-server-sdk");
    const expo = new Expo();

    if (!Expo.isExpoPushToken(token)) {
      console.log(`[Push] Invalid Expo token: ${token}`);
      return;
    }

    const message = {
      to: token,
      sound: "default" as const,
      title,
      body,
      data,
    };

    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log(`[Push] Successfully sent to ${token}`);
  } catch (error) {
    console.error("[Push] Failed to send notification:", error);
  }
}
