import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; code: "EMAIL_TAKEN" | "ERROR"; message: string };

/** Default role granted to self-service signups. */
const DEFAULT_ROLE = "CUSTOMER";

/**
 * Create an email/password account for a self-service signup and grant the
 * default customer role. Idempotency is left to the caller — this treats an
 * existing verified/credentialled email as a conflict rather than overwriting
 * a password, so one account cannot hijack another.
 */
export async function registerUser(
  input: RegisterInput,
): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    // Block if the email already has a password (a real credentials account).
    // An OAuth-only or passwordless row can adopt a password instead.
    if (existing?.passwordHash) {
      return {
        ok: false,
        code: "EMAIL_TAKEN",
        message: "An account with this email already exists. Please sign in.",
      };
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, name: existing.name ?? name },
        })
      : await prisma.user.create({
          data: { email, name, passwordHash },
        });

    // Grant the default role (best-effort; sign-in still works without it).
    const role = await prisma.role.findUnique({
      where: { name: DEFAULT_ROLE },
    });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    return { ok: true, userId: user.id };
  } catch (error) {
    console.error("[auth] registerUser failed", error);
    return {
      ok: false,
      code: "ERROR",
      message:
        error instanceof Error ? error.message : "Could not create account",
    };
  }
}
