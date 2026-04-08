import bcrypt from "bcryptjs";
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const fullName = process.env.ADMIN_FULL_NAME || "Safirisha Admin";
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL;
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !phone || !password) {
    throw new Error(
      "Missing ADMIN_EMAIL, ADMIN_PHONE, or ADMIN_PASSWORD in backend .env",
    );
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }, { phone }],
    },
  });

  if (existing) {
    console.log("Admin already exists");
    console.log(existing);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      fullName,
      username,
      email,
      phone,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Admin created successfully");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
