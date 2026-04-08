import { User } from "@prisma/client";

export function isProtectedSuperAdmin(user: Pick<User, "isSuperAdmin"> | null) {
  return !!user?.isSuperAdmin;
}
