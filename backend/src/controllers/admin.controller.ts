import { DriverApprovalStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { isValidKenyanPlate, normalizeKenyanPlate } from "../utils/validators";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string) {
  return /^[a-z0-9_.]{3,20}$/.test(username);
}

function canManageTarget(
  actor: { isSuperAdmin?: boolean; id?: string } | null,
  target: { isSuperAdmin?: boolean; id?: string } | null,
) {
  if (!actor || !target) return false;

  if (target.isSuperAdmin) {
    return actor.isSuperAdmin === true && actor.id === target.id;
  }

  return true;
}

function emitAdminStatsUpdated(req: AuthRequest) {
  const io = req.app.get("io");
  if (io) {
    io.emit("admin_stats_updated");
  }
}

export async function getAdminDashboard(req: AuthRequest, res: Response) {
  try {
    const [
      totalOrders,
      activeTrips,
      deliveredTrips,
      cancelledTrips,
      pendingDrivers,
      approvedDrivers,
      rejectedDrivers,
      onlineDrivers,
      busyDrivers,
      totalUsers,
      totalCustomers,
      totalDrivers,
      totalAdmins,
      activeUsers,
      suspendedUsers,
      revenueAgg,
      recentOrders,
    ] = await Promise.all([
      prisma.transportRequest.count(),
      prisma.transportRequest.count({
        where: {
          status: {
            in: [
              "SEARCHING",
              "ACCEPTED",
              "DRIVER_EN_ROUTE",
              "ARRIVED_PICKUP",
              "PICKUP_CONFIRMED",
              "IN_TRANSIT",
              "ARRIVED_DROPOFF",
              "DELIVERY_CONFIRMED",
            ],
          },
        },
      }),
      prisma.transportRequest.count({
        where: { status: "DELIVERED" },
      }),
      prisma.transportRequest.count({
        where: { status: "CANCELLED" },
      }),
      prisma.driverProfile.count({
        where: { approvalStatus: "PENDING" },
      }),
      prisma.driverProfile.count({
        where: { approvalStatus: "APPROVED" },
      }),
      prisma.driverProfile.count({
        where: { approvalStatus: "REJECTED" },
      }),
      prisma.driverProfile.count({
        where: { availability: "ONLINE" },
      }),
      prisma.driverProfile.count({
        where: { availability: "BUSY" },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: { role: "CUSTOMER" },
      }),
      prisma.user.count({
        where: { role: "DRIVER" },
      }),
      prisma.user.count({
        where: { role: "ADMIN" },
      }),
      prisma.user.count({
        where: { isActive: true },
      }),
      prisma.user.count({
        where: { isActive: false },
      }),
      prisma.transportRequest.aggregate({
        _sum: {
          estimatedPrice: true,
        },
        where: {
          status: "DELIVERED",
        },
      }),
      prisma.transportRequest.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          assignedDriver: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.json({
      stats: {
        totalOrders,
        activeTrips,
        deliveredTrips,
        cancelledTrips,
        pendingOrders: activeTrips,
        pendingDrivers,
        approvedDrivers,
        rejectedDrivers,
        onlineDrivers,
        busyDrivers,
        activeDrivers: onlineDrivers + busyDrivers,
        totalUsers,
        totalCustomers,
        totalDrivers,
        totalAdmins,
        activeUsers,
        suspendedUsers,
        deliveredRevenue: revenueAgg._sum.estimatedPrice ?? 0,
      },
      recentOrders,
    });
  } catch (error) {
    console.error("getAdminDashboard error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getAdminUsers(req: AuthRequest, res: Response) {
  try {
    const role = String(req.query.role || "").toUpperCase();
    const status = String(req.query.status || "").toUpperCase();

    const where: any = {};

    if (role && ["CUSTOMER", "DRIVER", "ADMIN"].includes(role)) {
      where.role = role as UserRole;
    }

    if (status === "SUSPENDED") {
      where.isActive = false;
    }

    if (
      status === "APPROVED" ||
      status === "PENDING" ||
      status === "REJECTED"
    ) {
      where.driverProfile = {
        is: {
          approvalStatus: status as DriverApprovalStatus,
        },
      };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        driverProfile: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ users });
  } catch (error) {
    console.error("getAdminUsers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getAdminUserById(req: AuthRequest, res: Response) {
  try {
    const userId = String(req.params.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
        customerRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("getAdminUserById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function createAdminManagedUser(req: AuthRequest, res: Response) {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        isSuperAdmin: true,
        role: true,
      },
    });

    if (!actor || actor.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can create users" });
    }

    const {
      fullName,
      username,
      email,
      phone,
      password,
      role,
      plateNumber,
      vehicleType,
      vehicleImageUrl,
      ownershipProofUrl,
      approvalStatus,
      isSuperAdmin,
    } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      phone?: string;
      password?: string;
      role?: UserRole;
      plateNumber?: string;
      vehicleType?: string;
      vehicleImageUrl?: string;
      ownershipProofUrl?: string;
      approvalStatus?: DriverApprovalStatus;
      isSuperAdmin?: boolean;
    };

    if (!fullName || !username || !email || !phone || !password || !role) {
      return res.status(400).json({
        message:
          "fullName, username, email, phone, password and role are required",
      });
    }

    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 characters and only use letters, numbers, underscore or dot",
      });
    }

    if (role === "ADMIN" && isSuperAdmin && !actor.isSuperAdmin) {
      return res.status(403).json({
        message: "Only super admin can create another super admin",
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

    if (role === "DRIVER") {
      if (!plateNumber || !vehicleType) {
        return res.status(400).json({
          message: "plateNumber and vehicleType are required for drivers",
        });
      }

      const normalizedPlate = normalizeKenyanPlate(plateNumber);

      if (!isValidKenyanPlate(normalizedPlate)) {
        return res.status(400).json({
          message: "Invalid Kenyan plate number format. Example: KDA 123A",
        });
      }

      const existingPlate = await prisma.driverProfile.findUnique({
        where: { plateNumber: normalizedPlate },
      });

      if (existingPlate) {
        return res.status(409).json({
          message: "Vehicle plate number already exists",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const safeApprovalStatus: DriverApprovalStatus =
        approvalStatus &&
        ["PENDING", "APPROVED", "REJECTED"].includes(approvalStatus)
          ? approvalStatus
          : "PENDING";

      const user = await prisma.user.create({
        data: {
          fullName,
          username: normalizedUsername,
          email,
          phone,
          passwordHash,
          role,
          isActive: true,
          isSuperAdmin: false,
          driverProfile: {
            create: {
              plateNumber: normalizedPlate,
              vehicleType,
              vehicleImageUrl:
                vehicleImageUrl?.trim() ||
                "/uploads/vehicles/default-driver.jpg",
              ownershipProofUrl:
                ownershipProofUrl?.trim() ||
                "/uploads/ownership/default-proof.jpg",
              approvalStatus: safeApprovalStatus,
              availability: "OFFLINE",
            },
          },
        },
        include: {
          driverProfile: true,
        },
      });

      emitAdminStatsUpdated(req);

      return res.status(201).json({
        message: "Driver created successfully",
        user,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        username: normalizedUsername,
        email,
        phone,
        passwordHash,
        role,
        isActive: true,
        isSuperAdmin:
          role === "ADMIN"
            ? Boolean(isSuperAdmin && actor.isSuperAdmin)
            : false,
      },
      include: {
        driverProfile: true,
      },
    });

    emitAdminStatsUpdated(req);

    return res.status(201).json({
      message: `${role} created successfully`,
      user,
    });
  } catch (error) {
    console.error("createAdminManagedUser error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getAdminTrips(req: AuthRequest, res: Response) {
  try {
    const trips = await prisma.transportRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        assignedDriver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return res.json({ trips });
  } catch (error) {
    console.error("getAdminTrips error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getAdminTripById(req: AuthRequest, res: Response) {
  try {
    const tripId = String(req.params.tripId);

    const trip = await prisma.transportRequest.findUnique({
      where: { id: tripId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            username: true,
          },
        },
        assignedDriver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                username: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    return res.json({
      trip,
      tracking: trip.assignedDriver
        ? {
            currentLat: trip.assignedDriver.currentLat,
            currentLng: trip.assignedDriver.currentLng,
            currentHeading: trip.assignedDriver.currentHeading,
            currentSpeed: trip.assignedDriver.currentSpeed,
            lastLocationAt: trip.assignedDriver.lastLocationAt,
            availability: trip.assignedDriver.availability,
          }
        : null,
    });
  } catch (error) {
    console.error("getAdminTripById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getPendingDrivers(req: AuthRequest, res: Response) {
  try {
    const drivers = await prisma.driverProfile.findMany({
      where: { approvalStatus: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ drivers });
  } catch (error) {
    console.error("getPendingDrivers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDriverApproval(req: AuthRequest, res: Response) {
  try {
    const driverId = String(req.params.driverId);
    const { approvalStatus } = req.body as {
      approvalStatus?: "APPROVED" | "REJECTED";
    };

    if (!approvalStatus || !["APPROVED", "REJECTED"].includes(approvalStatus)) {
      return res.status(400).json({ message: "Invalid approval status" });
    }

    const existingDriver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!existingDriver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (existingDriver.user.isSuperAdmin) {
      return res.status(403).json({
        message:
          "Super admin linked account cannot have driver approval changed",
      });
    }

    const driver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        approvalStatus,
        availability: "OFFLINE",
      },
      include: { user: true },
    });

    emitAdminStatsUpdated(req);

    return res.json({
      message: `Driver ${approvalStatus.toLowerCase()}`,
      driver,
    });
  } catch (error) {
    console.error("updateDriverApproval error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getDeletionRequests(req: AuthRequest, res: Response) {
  try {
    const requests = await prisma.driverDeletionRequest.findMany({
      include: {
        driver: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ deletionRequests: requests });
  } catch (error) {
    console.error("getDeletionRequests error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function updateDeletionRequestStatus(
  req: AuthRequest,
  res: Response,
) {
  try {
    const requestId = String(req.params.requestId);
    const { status, adminNote } = req.body as {
      status?: "APPROVED" | "REJECTED";
      adminNote?: string;
    };

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const existingRequest = await prisma.driverDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: {
          include: { user: true },
        },
      },
    });

    if (!existingRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (existingRequest.driver.user.isSuperAdmin) {
      return res.status(403).json({
        message: "Super admin cannot be deactivated through deletion request",
      });
    }

    let scheduledDeletion: Date | null = null;

    if (status === "APPROVED") {
      scheduledDeletion = new Date();
      scheduledDeletion.setHours(scheduledDeletion.getHours() + 48);
    }

    const updatedRequest = await prisma.driverDeletionRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminNote: adminNote ?? null,
        scheduledDeletion,
      },
      include: {
        driver: {
          include: { user: true },
        },
      },
    });

    if (status === "APPROVED") {
      await prisma.driverProfile.update({
        where: { id: updatedRequest.driverId },
        data: { availability: "OFFLINE" },
      });
    }

    if (status === "REJECTED") {
      await prisma.driverDeletionRequest.update({
        where: { id: requestId },
        data: {
          scheduledDeletion: null,
        },
      });
    }

    emitAdminStatsUpdated(req);

    return res.json({
      message: "Deletion request updated",
      deletionRequest: updatedRequest,
    });
  } catch (error) {
    console.error("updateDeletionRequestStatus error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function suspendUser(req: AuthRequest, res: Response) {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        isSuperAdmin: true,
      },
    });

    const userId = String(req.params.userId);
    const { reason } = req.body as { reason?: string };

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canManageTarget(actor, existingUser)) {
      return res.status(403).json({
        message: "Super admin cannot be suspended by another account",
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspensionReason: reason?.trim() || "Suspended by admin",
      },
      include: {
        driverProfile: true,
      },
    });

    if (existingUser.driverProfile) {
      await prisma.driverProfile.update({
        where: { id: existingUser.driverProfile.id },
        data: { availability: "OFFLINE" },
      });
    }

    emitAdminStatsUpdated(req);

    return res.json({
      message: "User suspended successfully",
      user,
    });
  } catch (error) {
    console.error("suspendUser error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function reactivateUser(req: AuthRequest, res: Response) {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        isSuperAdmin: true,
      },
    });

    const userId = String(req.params.userId);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canManageTarget(actor, existingUser)) {
      return res.status(403).json({
        message: "Super admin account cannot be managed by another account",
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    emitAdminStatsUpdated(req);

    return res.json({
      message: "User reactivated",
      user,
    });
  } catch (error) {
    console.error("reactivateUser error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getLiveDrivers(req: AuthRequest, res: Response) {
  try {
    const drivers = await prisma.driverProfile.findMany({
      where: {
        availability: {
          in: ["ONLINE", "BUSY"],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({
      drivers: drivers
        .filter(
          (driver) => driver.currentLat != null && driver.currentLng != null,
        )
        .map((driver) => ({
          id: driver.id,
          name: driver.user.fullName,
          currentLat: driver.currentLat,
          currentLng: driver.currentLng,
          availability: driver.availability,
          isActive: driver.user.isActive,
          vehicleType: driver.vehicleType,
          plateNumber: driver.plateNumber,
        })),
    });
  } catch (error) {
    console.error("getLiveDrivers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
