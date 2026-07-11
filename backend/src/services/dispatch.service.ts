import { prisma } from "../lib/prisma";
import { calculateDistanceKm } from "../utils/distance";
import { normalizeVehicleType } from "./trip.service";

type DispatchCandidate = {
  driverProfileId: string;
  userId: string;
  lat: number;
  lng: number;
  vehicleType: string;
  distanceKm: number;
  acceptanceRate: number;
  totalJobsDone: number;
  freshnessMinutes: number;
  rankingScore: number;
};

function getVehicleTypeAliases(input: string): string[] {
  const normalized = String(input || "").trim().toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string[]> = {
    BIKE: ["BIKE", "MOTORBIKE", "BODA"],
    TUKTUK: ["TUKTUK", "TUK_TUK"],
    PICKUP: ["PICKUP"],
    MEDIUM_LORRY: ["MEDIUM_LORRY", "LORRY"],
    LARGE_TRUCK: ["LARGE_TRUCK", "TRUCK"],
  };
  return map[normalized] || [normalized];
}

function calculateAcceptanceRate(totalAssigned: number, totalCompleted: number): number {
  if (totalAssigned === 0) return 1;
  return Math.min(1, totalCompleted / totalAssigned);
}

function calculateFreshnessMinutes(lastLocationAt: Date | null): number {
  if (!lastLocationAt) return 999;
  return (Date.now() - lastLocationAt.getTime()) / 60000;
}

function calculateRankingScore(candidate: {
  distanceKm: number;
  acceptanceRate: number;
  totalJobsDone: number;
  freshnessMinutes: number;
}): number {
  const distanceScore = Math.max(0, 100 - candidate.distanceKm * 2);
  const acceptanceScore = candidate.acceptanceRate * 50;
  const experienceScore = Math.min(20, candidate.totalJobsDone * 2);
  const freshnessScore = Math.max(0, 30 - candidate.freshnessMinutes);
  return distanceScore + acceptanceScore + experienceScore + freshnessScore;
}

export async function findNearbyDrivers({
  lat,
  lng,
  vehicleType,
  radiusKm = 15,
}: {
  lat: number;
  lng: number;
  vehicleType: string;
  radiusKm?: number;
}) {
  const normalizedTripVehicle = normalizeVehicleType(vehicleType);
  const vehicleAliases = getVehicleTypeAliases(normalizedTripVehicle);

  const drivers = await prisma.driverProfile.findMany({
    where: {
      availability: { not: "OFFLINE" },
      approvalStatus: "APPROVED",
      vehicleType: { in: vehicleAliases },
      currentLat: { not: null },
      currentLng: { not: null },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
    },
  });

   const activeDriverIds = (
     await prisma.transportRequest.findMany({
       where: {
         assignedDriverId: { not: null },
         status: {
           in: ["ACCEPTED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED_PICKUP", "PICKUP_CONFIRMED", "IN_TRANSIT", "ARRIVED_DROPOFF", "DELIVERY_CONFIRMED", "PAYMENT_PENDING"],
         },
       },
       select: { assignedDriverId: true },
     })
   ).map((r) => r.assignedDriverId).filter(Boolean) as string[];
  const busyDriverIdSet = new Set(activeDriverIds);

  const candidates: DispatchCandidate[] = [];

  for (const d of drivers) {
    if (d.currentLat == null || d.currentLng == null) continue;
    if (busyDriverIdSet.has(d.id)) continue;

    const distance = calculateDistanceKm(lat, lng, Number(d.currentLat), Number(d.currentLng));
    if (distance > radiusKm) continue;

     const completedJobs = await prisma.transportRequest.count({
       where: { assignedDriverId: d.id, status: "COMPLETED" },
     });
     const totalAssigned = await prisma.transportRequest.count({
       where: { assignedDriverId: { not: null } },
     });

    const acceptanceRate = calculateAcceptanceRate(totalAssigned, completedJobs);
    const freshnessMinutes = calculateFreshnessMinutes(d.lastLocationAt);

    candidates.push({
      driverProfileId: d.id,
      userId: d.userId,
      lat: Number(d.currentLat),
      lng: Number(d.currentLng),
      vehicleType: d.vehicleType || "",
      distanceKm: distance,
      acceptanceRate,
      totalJobsDone: completedJobs,
      freshnessMinutes,
      rankingScore: 0,
    });
  }

  for (const c of candidates) {
    c.rankingScore = calculateRankingScore(c);
  }

  return candidates.sort((a, b) => b.rankingScore - a.rankingScore);
}
