export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

export function isValidCoordinate(value: unknown): value is number {
  return isFiniteNumber(value);
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

export function assertValidCoordinatePair(lat: unknown, lng: unknown): void {
  if (!isValidCoordinatePair(lat, lng)) {
    throw new Error("Invalid latitude or longitude.");
  }
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function requireNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeKenyanPlate(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidKenyanPlate(value: string): boolean {
  const plate = normalizeKenyanPlate(value);

  const patterns = [
    /^[K][A-Z]{2}\d{3}[A-Z]$/, // KXX123X
    /^[K][A-Z]{2}\d{3}$/, // KXX123
    /^[K][A-Z]{3}\d{3}[A-Z]?$/, // KXXX123 or KXXX123X
  ];

  return patterns.some((pattern) => pattern.test(plate));
}
