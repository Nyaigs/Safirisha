export type LoadSize = "Small" | "Medium" | "Large" | "Extra Large" | "Custom";

export type AppLocation = {
  latitude: number;
  longitude: number;
  address?: string;
  placeId?: string;
};

export type LocationPoint = Required<Pick<AppLocation, "latitude" | "longitude">> & {
  address: string;
  placeId?: string;
};

export type DropoffPlace = {
  id: string;
  name?: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type VehicleId = "bike" | "tuktuk" | "pickup" | "lorry";

export type RouteTripParams = {
  requestId?: string;
  pickup?: string;
  pickupLat?: string;
  pickupLng?: string;
  dropoff?: string;
  dropoffLat?: string;
  dropoffLng?: string;
  vehicle?: string;
  loadDescription?: string;
  loadSize?: string;
  specialNotes?: string;
  estimatedPrice?: string;
  distanceKm?: string;
  driverName?: string;
  driverRating?: string;
  driverPhone?: string;
  plateNumber?: string;
  eta?: string;
};
