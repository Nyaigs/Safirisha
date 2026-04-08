import { verifyToken } from "@clerk/backend";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

type JwtPayload = {
  id: string;
  role: string;
};

type AuthIdentity = {
  authProvider: "legacy" | "clerk";
  legacyUserId?: string;
  clerkUserId?: string;
  role?: string;
};

export type AuthRequest = Request & {
  user?: {
    id: string;
    role: string;
    authProvider: "legacy" | "clerk";
    clerkUserId?: string;
  };
  authIdentity?: AuthIdentity;
};

async function resolveAuthIdentity(req: Request): Promise<AuthIdentity | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

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
        return {
          authProvider: "clerk",
          clerkUserId: String(payload.sub),
        };
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
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    return {
      authProvider: "legacy",
      legacyUserId: decoded.id,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function authenticateIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const identity = await resolveAuthIdentity(req);

    if (!identity) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    req.authIdentity = identity;
    next();
  } catch (error) {
    console.error("authenticateIdentity error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const identity = await resolveAuthIdentity(req);

    if (!identity) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    req.authIdentity = identity;

    if (identity.authProvider === "legacy") {
      const dbUser = await prisma.user.findUnique({
        where: { id: identity.legacyUserId },
        select: {
          id: true,
          role: true,
          isActive: true,
          clerkId: true,
        },
      });

      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ message: "Account is inactive" });
      }

      req.user = {
        id: dbUser.id,
        role: dbUser.role,
        authProvider: "legacy",
        clerkUserId: dbUser.clerkId ?? undefined,
      };

      return next();
    }

    const dbUser = await prisma.user.findFirst({
      where: { clerkId: identity.clerkUserId },
      select: {
        id: true,
        role: true,
        isActive: true,
        clerkId: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Account bootstrap required" });
    }

    if (!dbUser.isActive) {
      return res.status(401).json({ message: "Account is inactive" });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      authProvider: "clerk",
      clerkUserId: dbUser.clerkId ?? undefined,
    };

    next();
  } catch (error) {
    console.error("authenticate error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}
