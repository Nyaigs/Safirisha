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
  driverProfileId?: string | null;
};

let io: Server | null = null;
const chatRateLimits = new Map<string, { count: number, timestamp: number }>();

/**
 * Live in-memory registry of ONLINE drivers with reference counting for multi-tab support
 */

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
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }) as LegacyJwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { driverProfile: { select: { id: true } } },
    });

    if (!user?.isActive) return null;

    return {
      id: user.id,
      role: user.role,
      authProvider: "legacy",
      clerkUserId: user.clerkId ?? undefined,
      driverProfileId: user.driverProfile?.id,
    };
  } catch {
    return null;
  }
}

export function initSocket(server: HttpServer) {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:8081", "https://safirisha.onrender.com", "http://localhost:19006"];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Origin not allowed by Socket CORS"));
        }
      },
      methods: ["GET", "POST", "PATCH"],
      credentials: true,
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
    

    /**
     * DRIVER GOES OFFLINE
     */
    

    socket.on("join_trip_room", async (tripId: string) => {
      const trip = await prisma.transportRequest.findUnique({
        where: { id: tripId },
        select: { customerId: true, assignedDriverId: true },
      });

      if (!trip) return;

      const isCustomer = trip.customerId === user.id;
      // C-06 FIX: Use the cached driverProfileId instead of hitting the DB again
      const isDriver = trip.assignedDriverId === user.driverProfileId;
      const isAdmin = user.role === "ADMIN";

      if (isCustomer || isDriver || isAdmin) {
        socket.join(`trip:${tripId}`);
      }
    });

    socket.on("leave_trip_room", (tripId: string) => {
      socket.leave(`trip:${tripId}`);
    });

    socket.on("send_chat_message", async (payload: { tripId: string; text: string }) => {
      if (!payload.tripId || !payload.text) return;

      // Rate limit: max 20 messages per minute
      const now = Date.now();
      const limit = chatRateLimits.get(user.id) || { count: 0, timestamp: now };
      if (now - limit.timestamp > 60000) {
        limit.count = 1;
        limit.timestamp = now;
      } else {
        limit.count++;
      }
      chatRateLimits.set(user.id, limit);

      if (limit.count > 20) {
        socket.emit("chat_error", { message: "Too many messages. Please slow down." });
        return;
      }

      // Block chat if trip is over
      const trip = await prisma.transportRequest.findUnique({
        where: { id: payload.tripId },
        select: { status: true }
      });
      
      if (!trip || ["COMPLETED", "DELIVERED", "CANCELLED"].includes(trip.status)) {
        socket.emit("chat_error", { message: "This trip has ended. Chat is disabled." });
        return;
      }
      
      try {
        const msg = await prisma.chatMessage.create({
          data: {
            tripId: payload.tripId,
            senderId: user.id,
            senderName: (user as any).fullName || "User",
            text: payload.text,
          }
        });
        
        io!.to(`trip:${payload.tripId}`).emit("chat_message", msg);
      } catch (error) {
        console.error("Chat send error:", error);
      }
    });

    socket.on("disconnect", async () => {
      // P1 #18: In-memory driver map removed. DB is the single source of truth.
    });
  });

  return io;
}

export function getIO() {
  return io;
}

