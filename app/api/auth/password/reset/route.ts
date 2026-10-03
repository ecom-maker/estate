import { z } from "zod";
import bcrypt from "bcryptjs";
import { success, failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { consumeResetToken } from "@/lib/auth/password-reset";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10, "Invalid reset link"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`reset:${ip}`, 10, 60_000).ok) {
    return failure("RATE_LIMITED", "Too many attempts. Try again shortly.", 429);
  }

  try {
    const { token, password } = schema.parse(await request.json());

    const email = await consumeResetToken(token);
    if (!email) {
      return failure(
        "INVALID_TOKEN",
        "This reset link is invalid or has expired. Please request a new one.",
        400,
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return failure("INVALID_TOKEN", "Account not found.", 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return success({ reset: true });
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
