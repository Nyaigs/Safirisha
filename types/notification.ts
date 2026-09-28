export type NotificationType =
  | "trip_accepted"
  | "driver_en_route"
  | "driver_arrived_pickup"
  | "pickup_confirmed"
  | "in_transit"
  | "arrived_dropoff"
  | "delivery_confirmed"
  | "trip_completed"
  | "trip_cancelled";

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  tripId: string | null;
  isRead: boolean;
  createdAt: string;
};
