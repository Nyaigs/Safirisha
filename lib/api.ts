import { getBestAccessToken } from "./auth-token";
import { API_BASE_URL, API_TIMEOUT } from "./config";
import { disconnectSocket } from "./socket";

type JsonLike =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonLike;
};

function isAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid token") ||
    normalized.includes("jwt malformed") ||
    normalized.includes("jwt expired") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("missing token") ||
    normalized.includes("bootstrap required")
  );
}

let cachedLogout: (() => void) | null = null;

export function setLogoutHandler(fn: (() => void) | null) {
  cachedLogout = fn;
}

function clearBrokenSession() {
  try {
    disconnectSocket();
  } catch (error) {
    console.log("Socket disconnect during auth reset failed:", error);
  }

  if (cachedLogout) {
    cachedLogout();
  }
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const token = await getBestAccessToken();

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const isNativeBody =
    options.body instanceof Blob ||
    options.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(options.body) ||
    options.body instanceof URLSearchParams ||
    typeof options.body === "string";

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestBody =
    options.body == null
      ? undefined
      : isFormData || isNativeBody
        ? (options.body as BodyInit)
        : JSON.stringify(options.body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: unknown }).message)
          : `Request failed with status ${response.status}`;

      if (
        response.status === 401 ||
        response.status === 403 ||
        isAuthErrorMessage(message)
      ) {
        clearBrokenSession();
      }

      throw new Error(message);
    }

    return data;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error(`Could not reach backend at ${API_BASE_URL}`);
    }

    if (
      typeof error?.message === "string" &&
      isAuthErrorMessage(error.message)
    ) {
      clearBrokenSession();
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}