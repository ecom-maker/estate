import { auth } from "@/lib/auth";
import { hasPermission } from "./check";
import type { Permission } from "./permissions";

export async function assertAuthenticated() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function assertPermission(permission: Permission) {
  const session = await assertAuthenticated();
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!hasPermission(roles, permission)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
