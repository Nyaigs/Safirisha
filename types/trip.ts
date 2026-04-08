export type TripStatus =
  | "SEARCHING"
  | "ACCEPTED"
  | "DRIVER_EN_ROUTE"
  | "ARRIVED_PICKUP"
  | "PICKUP_CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED_DROPOFF"
  | "DELIVERY_CONFIRMED"
  | "PAYMENT_PENDING"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentMethod = "CASH" | "MPESA";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED";

export type DriverAvailability = "OFFLINE" | "ONLINE" | "BUSY";

export type AssignedDriver = {
  id: string;
  plateNumber: string;
  vehicleType: string;
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
  user: {
    id?: string;
    fullName: string;
    phone: string;
    email?: string;
    username?: string | null;
  };
};

export type TripCustomer = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  username?: string | null;
};

export type Trip = {
  id: string;
  customerId: string;
  assignedDriverId: string | null;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  loadDescription: string | null;
  loadSize: string;
  specialNotes: string | null;
  estimatedPrice: number;
  distanceKm: number;
  status: TripStatus;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
  platformFeePercent?: number;
  platformFeeAmount?: number;
  driverNetEarning?: number;
  paidAt?: string | null;
  completedAt?: string | null;
  cashConfirmedByDriver?: boolean;
  mpesaReceiptNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedDriver?: AssignedDriver | null;
  customer?: TripCustomer | null;
  distanceToPickupKm?: number;
};

export type DriverLiveLocation = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
};

export type TripAcceptedPayload = {
  tripId: string;
  status: TripStatus;
  driver: {
    id: string;
    name: string;
    phone: string;
    plateNumber: string;
    vehicleType: string;
  } | null;
  trip?: Trip;
};

export type TripUpdatedPayload = {
  trip: Trip;
};

export type TripStatusUpdatedPayload = {
  tripId: string;
  status: TripStatus;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
};

export type DriverLocationUpdatedPayload = {
  id: string;
  driverId?: string;
  tripId?: string;
  name?: string;
  currentLat?: number | null;
  currentLng?: number | null;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
  availability?: DriverAvailability | string | null;
  vehicleType?: string | null;
  plateNumber?: string | null;
  isActive?: boolean;
};
