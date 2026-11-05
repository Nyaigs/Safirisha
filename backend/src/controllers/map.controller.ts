import { Request, Response } from "express";
import { findNearbyDrivers } from "../services/dispatch.service";

export async function getNearbyDriversForMap(req: Request, res: Response) {
  try {
    const { lat, lng, vehicleType } = req.query;

    if (!lat || !lng || !vehicleType) {
      return res.status(400).json({ message: "lat, lng, and vehicleType are required" });
    }

    const drivers = await findNearbyDrivers({
      lat: Number(lat),
      lng: Number(lng),
      vehicleType: String(vehicleType),
      radiusKm: 10, // Show drivers within 10km
    });

    // Only return what the customer needs to see (no phone numbers or personal data)
    const safeDrivers = drivers.map(d => ({
      id: d.driverProfileId,
      lat: d.lat,
      lng: d.lng,
      vehicleType: d.vehicleType,
      distanceKm: d.distanceKm,
    }));

    return res.json({ drivers: safeDrivers });
  } catch (error) {
    console.error("[getNearbyDriversForMap]", error);
    return res.status(500).json({ message: "Server error" });
  }
}
