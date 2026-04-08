import { useAuthStore } from "../store/auth";

let clerkTokenGetter: null | (() => Promise<string | null>) = null;
let cachedClerkToken: string | null = null;

export function registerClerkTokenGetter(
  getter: (() => Promise<string | null>) | null,
) {
  clerkTokenGetter = getter;
}

export function setCachedClerkToken(token: string | null) {
  cachedClerkToken = token;
}

export function clearCachedClerkToken() {
  cachedClerkToken = null;
}

export async function getBestAccessToken(): Promise<string | null> {
  if (clerkTokenGetter) {
    try {
      cachedClerkToken = await clerkTokenGetter();
      if (cachedClerkToken) return cachedClerkToken;
    } catch (error) {
      console.log("Failed to get Clerk token:", error);
    }
  }

  return useAuthStore.getState().token ?? null;
}

export function getBestAccessTokenSync(): string | null {
  return cachedClerkToken ?? useAuthStore.getState().token ?? null;
}
