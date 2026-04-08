import { verifyToken } from "@clerk/backend";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
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

async function resolveSocketUser(token?: string): Promise<SocketUser | null> {
  if (!token) {
    return null;
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (clerkSecretKey) {
    try {
      const payload = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });

      if (payload?.sub) {
        const dbUser = await prisma.user.findFirst({
          where: { clerkId: String(payload.sub) },
          select: {
            id: true,
            role: true,
            isActive: true,
            clerkId: true,
          },
        });

        if (dbUser && dbUser.isActive) {
          return {
            id: dbUser.id,
            role: dbUser.role,
            authProvider: "clerk",
            clerkUserId: dbUser.clerkId ?? undefined,
          };
        }
      }
    } catch {
      // fall through to legacy JWT verification
    }
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as LegacyJwtPayload;

    if (!decoded?.id) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        role: true,
        isActive: true,
        clerkId: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return null;
    }

    return {
      id: dbUser.id,
      role: dbUser.role,
      authProvider: "legacy",
      clerkUserId: dbUser.clerkId ?? undefined,
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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await resolveSocketUser(token);

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_trip_room", (tripId: string) => {
      if (!tripId) return;
      socket.join(`trip:${tripId}`);
    });

    socket.on("leave_trip_room", (tripId: string) => {
      if (!tripId) return;
      socket.leave(`trip:${tripId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
}
