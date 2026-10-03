import { z } from "zod";
import { success, failure } from "@/lib/api/response";
import { registerUser } from "@/lib/auth/register";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  // Cap signups per IP to curb abuse / automated account creation.
  if (!rateLimit(`register:${ip}`, 5, 60_000).ok) {
    return failure("RATE_LIMITED", "Too many attempts. Try again shortly.", 429);
  }

  try {
    const body = await request.json();
    const input = schema.parse(body);
    const result = await registerUser(input);

    if (!result.ok) {
      const status = result.code === "EMAIL_TAKEN" ? 409 : 500;
      return failure(result.code, result.message, status);
    }

    // The client signs in with the same credentials after this succeeds.
    return success({ userId: result.userId, email: input.email.trim().toLowerCase() });
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
