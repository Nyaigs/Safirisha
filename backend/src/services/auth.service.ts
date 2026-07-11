import { verifyToken } from "@clerk/backend";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

type LegacyPayload = {
  id: string;
  role: string;
};

export async function resolveUserFromToken(token?: string) {
  if (!token) return null;

  const clerkKey = process.env.CLERK_SECRET_KEY;

  // Clerk auth
  if (clerkKey) {
    try {
      const payload = await verifyToken(token, { secretKey: clerkKey });

      if (payload?.sub) {
        const user = await prisma.user.findFirst({
          where: { clerkId: String(payload.sub) },
        });

        if (!user || !user.isActive) return null;

        return {
          id: user.id,
          role: user.role,
          authProvider: "clerk" as const,
        };
      }
    } catch {}
  }

  // Legacy JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as LegacyPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      role: user.role,
      authProvider: "legacy" as const,
    };
  } catch {
    return null;
  }
}
