import { verifyToken } from "@clerk/backend";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";

type LegacyJwtPayload = {
  id: string;
  role: string;
};

type SocketUser = {
  id: string;
  role: string;
  authProvider: "legacy" | "clerk";
  clerkUserId?: string;
};

let io: Server | null = null;

/**
 * Live in-memory registry of ONLINE drivers with reference counting for multi-tab support
 */
const onlineDrivers = new Map<string, Set<string>>();

function addOnlineDriver(userId: string, socketId: string) {
  if (!onlineDrivers.has(userId)) {
    onlineDrivers.set(userId, new Set());
  }
  onlineDrivers.get(userId)!.add(socketId);
}

function removeOnlineDriver(userId: string, socketId: string) {
  const sockets = onlineDrivers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineDrivers.delete(userId);
  }
}

function isDriverFullyOnline(userId: string): boolean {
  return (onlineDrivers.get(userId)?.size ?? 0) > 0;
}

async function resolveSocketUser(token?: string): Promise<SocketUser | null> {
  if (!token) return null;

  const clerkKey = process.env.CLERK_SECRET_KEY;

  if (clerkKey) {
    try {
      const payload = await verifyToken(token, { secretKey: clerkKey });

      if (payload?.sub) {
        const user = await prisma.user.findFirst({
          where: { clerkId: String(payload.sub) },
        });

        if (user?.isActive) {
          return {
            id: user.id,
            role: user.role,
            authProvider: "clerk",
            clerkUserId: user.clerkId ?? undefined,
          };
        }

        return null;
      }
    } catch {
      return null;
    }
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as LegacyJwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user?.isActive) return null;

    return {
      id: user.id,
      role: user.role,
      authProvider: "legacy",
      clerkUserId: user.clerkId ?? undefined,
    };
  } catch {
    return null;
  }
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = await resolveSocketUser(token);

    if (!user) return next(new Error("Unauthorized"));

    socket.data.user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    socket.join(`user:${user.id}`);

    /**
     * DRIVER GOES ONLINE
     */
    socket.on("driver:online", async () => {
      if (user.role !== "DRIVER") return;

      addOnlineDriver(user.id, socket.id);
      socket.join("drivers:online");

      try {
        const driver = await prisma.driverProfile.findUnique({
          where: { userId: user.id },
        });

        if (driver) {
          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              availability: "ONLINE",
              lastLocationAt: new Date(),
            },
          });

          io?.emit("driver_status_changed", {
            driverId: user.id,
            status: "ONLINE",
          });
        }
      } catch (error) {
        console.error("driver:online error:", error);
      }
    });

    /**
     * DRIVER GOES OFFLINE
     */
    socket.on("driver:offline", async () => {
      if (user.role !== "DRIVER") return;

      removeOnlineDriver(user.id, socket.id);
      socket.leave("drivers:online");

      if (isDriverFullyOnline(user.id)) return;

      try {
        const driver = await prisma.driverProfile.findUnique({
          where: { userId: user.id },
        });

        if (driver) {
          await prisma.driverProfile.update({
            where: { id: driver.id },
            data: {
              availability: "OFFLINE",
            },
          });

          io?.emit("driver_status_changed", {
            driverId: user.id,
            status: "OFFLINE",
          });
        }
      } catch (error) {
        console.error("driver:offline error:", error);
      }
    });

    socket.on("join_trip_room", async (tripId: string) => {
      const trip = await prisma.transportRequest.findUnique({
        where: { id: tripId },
        select: { customerId: true, assignedDriverId: true },
      });

      if (!trip) return;

      const isCustomer = trip.customerId === user.id;
      const isDriver = trip.assignedDriverId
        ? (await prisma.driverProfile.findUnique({
            where: { id: trip.assignedDriverId },
            select: { userId: true },
          }))?.userId === user.id
        : false;
      const isAdmin = user.role === "ADMIN";

      if (isCustomer || isDriver || isAdmin) {
        socket.join(`trip:${tripId}`);
      }
    });

    socket.on("leave_trip_room", (tripId: string) => {
      socket.leave(`trip:${tripId}`);
    });

    socket.on("disconnect", async () => {
      if (user.role === "DRIVER") {
        removeOnlineDriver(user.id, socket.id);

        if (!isDriverFullyOnline(user.id)) {
          socket.leave("drivers:online");

          try {
            const driver = await prisma.driverProfile.findUnique({
              where: { userId: user.id },
            });

            if (driver) {
              await prisma.driverProfile.update({
                where: { id: driver.id },
                data: {
                  availability: "OFFLINE",
                },
              });

              io?.emit("driver_status_changed", {
                driverId: user.id,
                status: "OFFLINE",
              });
            }
          } catch (error) {
            console.error("disconnect driver offline error:", error);
          }
        }
      }
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function getOnlineDrivers() {
  return Array.from(onlineDrivers.keys());
}
