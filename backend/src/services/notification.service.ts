import { prisma } from "../lib/prisma";

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

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  tripId?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      tripId: input.tripId ?? null,
    },
  });
}

export async function listNotifications(userId: string, limit = 50) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unreadCount };
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  return result.count === 1;
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}
