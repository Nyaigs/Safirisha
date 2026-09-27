export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  distanceKm?: number;
}

export interface RouteResult {
  polyline: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
}

export interface MapsProvider {
  searchPlaces(query: string, bias?: { lat: number; lng: number }): Promise<PlaceResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<RouteResult | null>;
}

type GeoapifyFeature = {
  geometry?: { coordinates?: unknown };
  properties?: {
    place_id?: string | number;
    formatted?: string;
    name?: string;
    address_line1?: string;
    lat?: unknown;
    lon?: unknown;
    categories?: string[];
    distance?: number;
    time?: number;
  };
};

type GeoapifyResponse = { features?: GeoapifyFeature[] };

function distanceBetweenKm(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(destination.lat - origin.lat);
  const dLng = radians(destination.lng - origin.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordinatesFrom(value: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [longitude, latitude] = value;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return { latitude, longitude };
}

export class GeoapifyProvider implements MapsProvider {
  private readonly key = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;

  private requireKey(): string {
    if (!this.key) throw new Error("Geoapify is unavailable because EXPO_PUBLIC_GEOAPIFY_KEY is not configured.");
    return this.key;
  }

  async searchPlaces(query: string, bias?: { lat: number; lng: number }): Promise<PlaceResult[]> {
    const key = this.requireKey();
    const params = new URLSearchParams({ text: query.trim(), filter: "countrycode:ke", limit: "8", apiKey: key });
    if (bias) params.set("bias", `proximity:${bias.lng},${bias.lat}`);
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);
    if (!response.ok) throw new Error(`Place search failed (${response.status}). Please retry.`);
    const data = await response.json() as GeoapifyResponse;
    return (data.features ?? []).flatMap((feature) => {
      const properties = feature.properties;
      const latitude = Number(properties?.lat);
      const longitude = Number(properties?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const address = properties?.formatted || properties?.address_line1 || "Unknown location";
      const result: PlaceResult = {
        id: String(properties?.place_id ?? `${latitude},${longitude}`),
        name: properties?.name || properties?.address_line1 || address,
        address,
        latitude,
        longitude,
        category: properties?.categories?.[0],
      };
      if (bias) result.distanceKm = distanceBetweenKm(bias, { lat: latitude, lng: longitude });
      return [result];
    });
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const key = this.requireKey();
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), apiKey: key });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`);
    if (!response.ok) throw new Error(`Address lookup failed (${response.status}). Please retry.`);
    const data = await response.json() as GeoapifyResponse;
    return data.features?.[0]?.properties?.formatted || "Pinned location";
  }

  async getRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<RouteResult | null> {
    const key = this.requireKey();
    const params = new URLSearchParams({
      waypoints: `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`,
      mode: "drive",
      apiKey: key,
    });
    const response = await fetch(`https://api.geoapify.com/v1/routing?${params.toString()}`);
    if (!response.ok) throw new Error(`Route lookup failed (${response.status}). Please retry.`);
    const data = await response.json() as GeoapifyResponse;
    const feature = data.features?.[0];
    const rawCoordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(rawCoordinates)) return null;
    const polyline = rawCoordinates.flatMap((coordinate) => {
      const point = coordinatesFrom(coordinate);
      return point ? [point] : [];
    });
    if (polyline.length < 2) return null;
    return {
      polyline,
      distanceKm: Number(feature?.properties?.distance ?? 0) / 1000,
      durationMin: Number(feature?.properties?.time ?? 0) / 60,
    };
  }
}

export class GoogleProvider implements MapsProvider {
  private readonly key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

  private unavailable(): Error {
    return new Error(this.key
      ? "Google Maps provider is a stub and does not make network requests yet."
      : "Google Maps is not configured: EXPO_PUBLIC_GOOGLE_MAPS_KEY is missing.");
  }

  async searchPlaces(_query: string, _bias?: { lat: number; lng: number }): Promise<PlaceResult[]> {
    throw this.unavailable();
  }

  async reverseGeocode(_lat: number, _lng: number): Promise<string> {
    throw this.unavailable();
  }

  async getRoute(_origin: { lat: number; lng: number }, _destination: { lat: number; lng: number }): Promise<RouteResult | null> {
    throw this.unavailable();
  }
}

const selectedProvider = process.env.EXPO_PUBLIC_MAPS_PROVIDER?.trim().toLowerCase();
export const maps: MapsProvider = selectedProvider === "google"
  ? new GoogleProvider()
  : new GeoapifyProvider();
