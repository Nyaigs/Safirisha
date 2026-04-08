const rawHostBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://192.168.0.25:5000";

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

const normalizedHost = normalizeUrl(rawHostBaseUrl);

export const API_BASE_URL = normalizedHost.endsWith("/api")
  ? normalizedHost
  : `${normalizedHost}/api`;

export const SOCKET_BASE_URL = normalizeUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || normalizedHost,
);

export const API_TIMEOUT = 15000;
