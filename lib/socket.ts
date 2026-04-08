import { io, Socket } from "socket.io-client";
import { getBestAccessTokenSync } from "./auth-token";
import { SOCKET_BASE_URL } from "./config";

let socketInstance: Socket | null = null;

function getLatestToken(): string | null {
  return getBestAccessTokenSync();
}

function buildSocket(): Socket {
  const socket = io(SOCKET_BASE_URL, {
    transports: ["websocket"],
    autoConnect: false,
    auth: {
      token: getLatestToken(),
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

function attachBaseListeners(socket: Socket) {
  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.log("Socket connect error:", error?.message);
  });
}

export function getSocket(): Socket {
  const latestToken = getLatestToken();

  if (!socketInstance) {
    socketInstance = buildSocket();
    attachBaseListeners(socketInstance);
  }

  socketInstance.auth = { token: latestToken };

  return socketInstance;
}

export function connectSocket(): Socket {
  const socket = getSocket();

  socket.auth = { token: getLatestToken() };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (!socketInstance) return;

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
}

export function joinTripRoom(tripId: string) {
  const socket = connectSocket();
  socket.emit("join_trip_room", tripId);
}

export function leaveTripRoom(tripId: string) {
  if (!socketInstance) return;
  socketInstance.emit("leave_trip_room", tripId);
}

export function reconnectSocketWithLatestToken(): Socket {
  disconnectSocket();
  return connectSocket();
}

export function subscribeToAdminStats(handler: () => void) {
  const socket = connectSocket();
  socket.on("admin_stats_updated", handler);

  return () => {
    socket.off("admin_stats_updated", handler);
  };
}

export function subscribeToDriverLocationUpdated(
  handler: (payload: {
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
    availability?: string | null;
    vehicleType?: string | null;
    plateNumber?: string | null;
    isActive?: boolean;
  }) => void,
) {
  const socket = connectSocket();
  socket.on("driver_location_updated", handler);

  return () => {
    socket.off("driver_location_updated", handler);
  };
}

export function subscribeToNewTrips(handler: (payload: any) => void) {
  const socket = connectSocket();
  socket.on("new_trip_created", handler);

  return () => {
    socket.off("new_trip_created", handler);
  };
}

export function subscribeToTripAccepted(
  handler: (payload: {
    tripId: string;
    status: string;
    driver?: {
      id: string;
      name: string;
      phone: string;
      plateNumber: string;
      vehicleType: string;
    } | null;
    trip?: any;
  }) => void,
) {
  const socket = connectSocket();
  socket.on("trip_accepted", handler);

  return () => {
    socket.off("trip_accepted", handler);
  };
}

export function subscribeToTripUpdated(
  handler: (payload: { trip: any }) => void,
) {
  const socket = connectSocket();
  socket.on("trip_updated", handler);

  return () => {
    socket.off("trip_updated", handler);
  };
}

export function subscribeToTripStatusUpdated(
  handler: (payload: {
    tripId: string;
    status: string;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
  }) => void,
) {
  const socket = connectSocket();
  socket.on("trip_status_updated", handler);

  return () => {
    socket.off("trip_status_updated", handler);
  };
}
