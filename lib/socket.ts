import { io, Socket } from "socket.io-client";
import { SOCKET_BASE_URL } from "./config";
import type {
  TripAcceptedPayload,
  TripUpdatedPayload,
  TripStatusUpdatedPayload,
  TripExpiredPayload,
  DriverLocationUpdatedPayload,
} from "../types/trip";

let socket: Socket | null = null;
let connectCount = 0;
let tokenProvider: (() => string | null) | null = null;

export function setTokenProvider(fn: (() => string | null) | null) {
  tokenProvider = fn;
}

function getToken() {
  return tokenProvider ? tokenProvider() : null;
}

function createSocket() {
  return io(SOCKET_BASE_URL, {
    transports: ["websocket"],
    autoConnect: false,
    auth: { token: getToken() },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}

export function getSocket() {
  if (!socket) socket = createSocket();
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getToken() };
  if (!s.connected) {
    s.connect();
  }
  connectCount++;
  return s;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  connectCount = 0;
}

export function subscribe(event: string, handler: (...args: any[]) => void) {
  const s = connectSocket();
  s.on(event, handler);
  return () => { s.off(event, handler); };
}

export function joinTripRoom(tripId: string) {
  const s = getSocket();
  if (s.connected) s.emit("join_trip_room", tripId);
}

export function leaveTripRoom(tripId: string) {
  const s = getSocket();
  if (s.connected) s.emit("leave_trip_room", tripId);
}

export function subscribeToDriverLocationUpdated(handler: (payload: any) => void) {
  return subscribe("driver_location_updated", handler);
}

export function emitDriverOnline() {
  const s = connectSocket();
  s.emit("driver:online");
}

export function emitDriverOffline() {
  const s = getSocket();
  if (s.connected) s.emit("driver:offline");
}

export function onTripAccepted(handler: (payload: TripAcceptedPayload) => void) {
  return subscribe("trip_accepted", handler);
}

export function onTripUpdated(handler: (payload: TripUpdatedPayload) => void) {
  return subscribe("trip_updated", handler);
}

export function onTripStatusUpdated(handler: (payload: TripStatusUpdatedPayload) => void) {
  return subscribe("trip_status_updated", handler);
}

export function onTripExpired(handler: (payload: TripExpiredPayload) => void) {
  return subscribe("trip_expired", handler);
}

export function onDriverLocationUpdated(handler: (payload: DriverLocationUpdatedPayload) => void) {
  return subscribe("driver_location_updated", handler);
}

export function onDriverAvailabilityUpdated(handler: (payload: { driverId: string; availability: string }) => void) {
  return subscribe("driver_availability_updated", handler);
}

export function onNewTripCreated(handler: (...args: any[]) => void) {
  return subscribe("new_trip_created", handler);
}

export function reconnectSocketWithLatestToken() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectCount = 0;
  connectSocket();
}

export function refreshSocketToken() {
  if (socket && socket.connected) {
    socket.auth = { token: getToken() };
  }
}
