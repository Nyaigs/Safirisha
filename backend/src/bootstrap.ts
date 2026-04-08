import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

export async function bootstrapSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const fullName =
    process.env.SUPER_ADMIN_NAME?.trim() || "Safirisha Super Admin";
  const username =
    process.env.SUPER_ADMIN_USERNAME?.trim().toLowerCase() || "safiri.admin";
  const phone = process.env.SUPER_ADMIN_PHONE?.trim() || "0700000000";

  if (!email || !password) {
    console.log(
      "Skipping super admin bootstrap: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD missing",
    );
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  if (!existing) {
    await prisma.user.create({
      data: {
        fullName,
        username,
        email,
        phone,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        isSuperAdmin: true,
      },
    });

    console.log("Super admin created successfully");
    return;
  }

  if (!existing.isSuperAdmin || existing.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        isSuperAdmin: true,
        isActive: true,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    console.log("Existing account promoted to super admin");
  }
}
