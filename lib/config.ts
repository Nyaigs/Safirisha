function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const rawHostBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL;

if (!rawHostBaseUrl) {
  throw new Error(
    "[Safirisha Config] Missing EXPO_PUBLIC_API_BASE_URL or EXPO_PUBLIC_API_URL in your .env file. " +
      "Add EXPO_PUBLIC_API_BASE_URL=http://192.168.0.27:5000/api then restart with: npx expo start --clear",
  );
}

const normalizedHost = normalizeUrl(rawHostBaseUrl);

export const API_BASE_URL = normalizedHost.endsWith("/api")
  ? normalizedHost
  : `${normalizedHost}/api`;

export const SOCKET_BASE_URL = normalizeUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || normalizedHost,
);

export const API_TIMEOUT = 15000;