import { RequestStatus } from "@prisma/client";

export const SEARCH_EXPIRY_MINUTES = 5;

export function normalizeVehicleType(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const aliases: Record<string, string> = {
    BIKE: "BIKE",
    MOTORBIKE: "BIKE",
    BODA: "BIKE",
    TUKTUK: "TUKTUK",
    TUK_TUK: "TUKTUK",
    PICKUP: "PICKUP",
    LORRY: "MEDIUM_LORRY",
    TRUCK: "LARGE_TRUCK",
  };

  return aliases[normalized] ?? normalized;
}

export const ACTIVE_DRIVER_TRIP_STATUSES: RequestStatus[] = [
  "ACCEPTED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING",
];

export function getExpiryDate() {
  return new Date(Date.now() + SEARCH_EXPIRY_MINUTES * 60 * 1000);
}

export function isExpiredSearchingTrip(trip: {
  status: RequestStatus;
  expiresAt?: Date | null;
}) {
  return (
    trip.status === "SEARCHING_DRIVER" &&
    !!trip.expiresAt &&
    trip.expiresAt.getTime() <= Date.now()
  );
}

export function buildTripInclude() {
  return {
    customer: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        username: true,
      },
    },
    assignedDriver: {
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            username: true,
          },
        },
      },
    },
  } as const;
}
