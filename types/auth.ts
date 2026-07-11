export type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

export type DriverProfile = {
  id: string;
  plateNumber?: string | null;
  vehicleType?: string | null;
  vehicleImageUrl?: string | null;
  ownershipProofUrl?: string | null;
  approvalStatus?: string;
  availability?: "OFFLINE" | "ONLINE" | "BUSY";
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
};

export type AuthUser = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  phone?: string | null;
  role: UserRole;
  driverProfile?: DriverProfile | null;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type RegisterResponse = {
  message: string;
  token?: string;
  user?: AuthUser;
};
