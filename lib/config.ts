function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const rawHostBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL;

if (!rawHostBaseUrl) {
  throw new Error(
    "[Safirisha Config] Missing EXPO_PUBLIC_API_BASE_URL in your .env file. " +
      "Add EXPO_PUBLIC_API_BASE_URL=https://your-backend-url/api then restart with: npx expo start --clear",
  );
}

const normalizedHost = normalizeUrl(rawHostBaseUrl);

// API_BASE_URL ends with /api
export const API_BASE_URL = normalizedHost.endsWith("/api")
  ? normalizedHost
  : `${normalizedHost}/api`;

// SOCKET_BASE_URL strips /api so Socket.IO hits server root
const hostWithoutApi = normalizedHost.replace(/\/api$/, "");

export const SOCKET_BASE_URL = normalizeUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || hostWithoutApi,
);

// 45s timeout covers Render free-tier cold starts
export const API_TIMEOUT = 45000;
