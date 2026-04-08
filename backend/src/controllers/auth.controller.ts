import { createClerkClient } from "@clerk/backend";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

const clerkClient = clerkSecretKey
  ? createClerkClient({
      secretKey: clerkSecretKey,
    })
  : null;

function signToken(id: string, role: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return jwt.sign({ id, role }, secret, {
    expiresIn: "7d",
  });
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string) {
  return /^[a-z0-9_.]{3,20}$/.test(username);
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildFallbackName(params: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  if (params.fullName?.trim()) return params.fullName.trim();

  const joined = [params.firstName, params.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (joined) return joined;
  if (params.username?.trim()) return params.username.trim();
  if (params.email?.trim()) return params.email.trim();

  return "Safirisha User";
}

function buildSafePhone(clerkUserId: string, phone: string | null) {
  if (phone && phone.trim()) return phone.trim();

  // fallback required because Prisma schema has phone as required string
  return `clerk_${clerkUserId}`.slice(0, 100);
}

function buildSafeEmail(clerkUserId: string, email: string | null) {
  if (email && email.trim()) return email.trim().toLowerCase();

  return `${clerkUserId}@users.safirisha.local`;
}

function buildSafeUsername(username?: string | null) {
  if (!username?.trim()) return null;

  const normalized = normalizeUsername(username);
  return isValidUsername(normalized) ? normalized : null;
}

export async function registerCustomer(req: Request, res: Response) {
  try {
    const { fullName, username, email, phone, password } = req.body;

    if (!fullName || !username || !email || !phone || !password) {
      return res.status(400).json({
        message: "Full name, username, email, phone and password are required",
      });
    }

    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 characters and only use letters, numbers, underscore or dot",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username, email or phone already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        username: normalizedUsername,
        email: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
        passwordHash,
        role: "CUSTOMER",
      },
      include: {
        driverProfile: true,
      },
    });

    const token = signToken(user.id, user.role);

    return res.status(201).json({
      message: "Customer registered successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("registerCustomer error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function registerDriver(req: Request, res: Response) {
  try {
    const { fullName, username, email, phone, password } = req.body;

    if (!fullName || !username || !email || !phone || !password) {
      return res.status(400).json({
        message: "Full name, username, email, phone and password are required",
      });
    }

    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 characters and only use letters, numbers, underscore or dot",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username, email or phone already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        username: normalizedUsername,
        email: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
        passwordHash,
        role: "DRIVER",
        isActive: true,
        driverProfile: {
          create: {
            approvalStatus: "PENDING",
            availability: "OFFLINE",
          },
        },
      },
      include: {
        driverProfile: true,
      },
    });

    const token = signToken(user.id, user.role);

    return res.status(201).json({
      message: "Driver registered successfully",
      token,
      user,
      requiresKyc: true,
    });
  } catch (error) {
    console.error("registerDriver error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const identifier = req.body.identifier || req.body.phoneOrEmail;
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "identifier and password are required",
      });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { phone: String(identifier).trim() },
          { username: normalizedIdentifier },
        ],
      },
      include: {
        driverProfile: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "This account has been deactivated",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        message:
          "This account uses Clerk sign-in. Please continue with Clerk authentication.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = signToken(user.id, user.role);

    return res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function clerkBootstrap(req: AuthRequest, res: Response) {
  try {
    if (!clerkClient) {
      return res.status(500).json({
        message: "Clerk is not configured on the backend",
      });
    }

    const clerkUserId = req.authIdentity?.clerkUserId;

    if (!clerkUserId) {
      return res.status(401).json({
        message: "Missing Clerk identity",
      });
    }

    const requestedRole =
      req.body?.role === "DRIVER" || req.body?.role === "ADMIN"
        ? req.body.role
        : "CUSTOMER";

    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (item) => item.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      null;

    const primaryPhone =
      clerkUser.phoneNumbers.find(
        (item) => item.id === clerkUser.primaryPhoneNumberId,
      )?.phoneNumber ||
      clerkUser.phoneNumbers[0]?.phoneNumber ||
      null;

    const fallbackName = buildFallbackName({
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      username: clerkUser.username,
      email: primaryEmail,
    });

    const safeEmail = buildSafeEmail(clerkUserId, primaryEmail);
    const safePhone = buildSafePhone(clerkUserId, primaryPhone);
    const safeUsername = buildSafeUsername(clerkUser.username);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ clerkId: clerkUserId }, { email: safeEmail }],
      },
      include: {
        driverProfile: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          fullName: fallbackName,
          username: safeUsername,
          email: safeEmail,
          phone: safePhone,
          passwordHash: "",
          role: requestedRole,
          isActive: true,
          ...(requestedRole === "DRIVER"
            ? {
                driverProfile: {
                  create: {
                    approvalStatus: "PENDING",
                    availability: "OFFLINE",
                  },
                },
              }
            : {}),
        },
        include: {
          driverProfile: true,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          clerkId: user.clerkId ?? clerkUserId,
          fullName: user.fullName || fallbackName,
          email: user.email || safeEmail,
          phone: user.phone || safePhone,
          username: user.username || safeUsername,
        },
        include: {
          driverProfile: true,
        },
      });

      if (user.role === "DRIVER" && !user.driverProfile) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            driverProfile: {
              create: {
                approvalStatus: "PENDING",
                availability: "OFFLINE",
              },
            },
          },
          include: {
            driverProfile: true,
          },
        });
      }
    }

    return res.json({
      message: "Clerk bootstrap successful",
      user,
      requiresKyc: user.role === "DRIVER" && !user.driverProfile?.plateNumber,
    });
  } catch (error) {
    console.error("clerkBootstrap error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateMe(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { fullName, username, email, phone } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!fullName || !username || !email || !phone) {
      return res.status(400).json({
        message: "Full name, username, email and phone are required",
      });
    }

    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 characters and only use letters, numbers, underscore or dot",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { email: String(email).trim().toLowerCase() },
              { phone: String(phone).trim() },
              { username: normalizedUsername },
            ],
          },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username, email or phone already exists",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: String(fullName).trim(),
        username: normalizedUsername,
        email: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
      },
      include: {
        driverProfile: true,
      },
    });

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("updateMe error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { identifier } = req.body as { identifier?: string };

    if (!identifier) {
      return res.status(400).json({
        message: "identifier is required",
      });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
          { phone: String(identifier).trim() },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with those details",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        message:
          "This account uses Clerk sign-in. Reset the password through the Clerk flow.",
      });
    }

    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCode: code,
        passwordResetCodeExpiresAt: expiresAt,
        passwordResetVerified: false,
      },
    });

    return res.json({
      message: "Reset code generated successfully",
      ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function verifyPasswordResetCode(req: Request, res: Response) {
  try {
    const { identifier, code } = req.body as {
      identifier?: string;
      code?: string;
    };

    if (!identifier || !code) {
      return res.status(400).json({
        message: "identifier and code are required",
      });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
          { phone: String(identifier).trim() },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with those details",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        message:
          "This account uses Clerk sign-in. Reset the password through the Clerk flow.",
      });
    }

    if (!user.passwordResetCode || !user.passwordResetCodeExpiresAt) {
      return res.status(400).json({
        message: "No active reset code found. Please request a new one.",
      });
    }

    if (user.passwordResetCode !== String(code).trim()) {
      return res.status(400).json({
        message: "Invalid reset code",
      });
    }

    if (user.passwordResetCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: "Reset code has expired. Please request a new one.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetVerified: true,
      },
    });

    return res.json({
      message: "Reset code verified successfully",
    });
  } catch (error) {
    console.error("verifyPasswordResetCode error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function resetPasswordWithCode(req: Request, res: Response) {
  try {
    const { identifier, code, newPassword } = req.body as {
      identifier?: string;
      code?: string;
      newPassword?: string;
    };

    if (!identifier || !code || !newPassword) {
      return res.status(400).json({
        message: "identifier, code and newPassword are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
          { phone: String(identifier).trim() },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with those details",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        message:
          "This account uses Clerk sign-in. Reset the password through the Clerk flow.",
      });
    }

    if (!user.passwordResetCode || !user.passwordResetCodeExpiresAt) {
      return res.status(400).json({
        message: "No active reset code found. Please request a new one.",
      });
    }

    if (user.passwordResetCode !== String(code).trim()) {
      return res.status(400).json({
        message: "Invalid reset code",
      });
    }

    if (user.passwordResetCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: "Reset code has expired. Please request a new one.",
      });
    }

    if (!user.passwordResetVerified) {
      return res.status(400).json({
        message: "Reset code has not been verified yet",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetCode: null,
        passwordResetCodeExpiresAt: null,
        passwordResetVerified: false,
      },
    });

    return res.json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("resetPasswordWithCode error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
