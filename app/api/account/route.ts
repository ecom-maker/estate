import { z } from "zod";
import bcrypt from "bcryptjs";
import { success, failure } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email("Enter a valid email").optional(),
    phone: z
      .string()
      .trim()
      .min(8, "Enter a valid contact number")
      .max(20)
      .optional()
      .or(z.literal("")),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200)
      .optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return failure("UNAUTHORIZED", "Please sign in", 401);

  try {
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return failure("NOT_FOUND", "Account not found", 404);

    const data: {
      name?: string;
      email?: string;
      phone?: string | null;
      passwordHash?: string;
    } = {};

    if (input.name !== undefined) data.name = input.name;

    if (input.email !== undefined) {
      const email = input.email.toLowerCase();
      if (email !== user.email) {
        const clash = await prisma.user.findUnique({ where: { email } });
        if (clash && clash.id !== userId) {
          return failure("EMAIL_TAKEN", "That email is already in use", 409);
        }
        data.email = email;
      }
    }

    if (input.phone !== undefined) {
      const phone = input.phone.replace(/\s+/g, "");
      if (phone === "") {
        data.phone = null;
      } else if (phone !== user.phone) {
        const clash = await prisma.user.findFirst({ where: { phone } });
        if (clash && clash.id !== userId) {
          return failure("PHONE_TAKEN", "That number is already in use", 409);
        }
        data.phone = phone;
      }
    }

    // Password change: require the current password when one is already set.
    if (input.newPassword) {
      if (user.passwordHash) {
        const ok =
          !!input.currentPassword &&
          (await bcrypt.compare(input.currentPassword, user.passwordHash));
        if (!ok) {
          return failure(
            "INVALID_PASSWORD",
            "Current password is incorrect",
            400,
          );
        }
      }
      data.passwordHash = await bcrypt.hash(input.newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return success({ updated: false });
    }

    await prisma.user.update({ where: { id: userId }, data });
    return success({ updated: true });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid input")
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return failure("VALIDATION_ERROR", message, 400);
  }
}
