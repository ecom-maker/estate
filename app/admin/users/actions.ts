"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { assertAuthenticated } from "@/lib/rbac/guards";
import { ADMIN_ROLE_NAMES } from "@/lib/admin/admin-roles";

export type CreateAdminState = { error?: string; ok?: boolean };

/** Only a Super Admin may create or promote admin users (prevents escalation). */
async function requireSuperAdmin() {
  const session = await assertAuthenticated();
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("SUPER_ADMIN")) throw new Error("FORBIDDEN");
  return session;
}

export async function createAdminUser(
  _prev: CreateAdminState,
  formData: FormData,
): Promise<CreateAdminState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Only a Super Admin can create admin users." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleName = String(formData.get("role") ?? "COMPANY_ADMIN");

  if (name.length < 2) return { error: "Enter the person's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Enter a valid email address." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!(ADMIN_ROLE_NAMES as readonly string[]).includes(roleName))
    return { error: "Choose a valid admin role." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.passwordHash)
      return { error: "An account with this email already exists." };

    const passwordHash = await bcrypt.hash(password, 10);
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, name: existing.name ?? name },
        })
      : await prisma.user.create({ data: { email, name, passwordHash } });

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role)
      return { error: `Role "${roleName}" is not set up. Seed roles first.` };

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create user.",
    };
  }
}
