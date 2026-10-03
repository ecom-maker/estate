import { z } from "zod";
import { success, failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { createResetToken } from "@/lib/auth/password-reset";
import { sendEmail, escapeHtml } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email() });

/** Build the site origin from the request, falling back to configured URLs. */
function originFrom(request: Request): string {
  const envUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.CANONICAL_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "https://estate-sugg.vercel.app";
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`forgot:${ip}`, 5, 60_000).ok) {
    return failure("RATE_LIMITED", "Too many requests. Try again shortly.", 429);
  }

  try {
    const { email } = schema.parse(await request.json());
    const normalized = email.toLowerCase();

    // Only mint + send when a real credentials-capable account exists, but the
    // response is identical either way so the endpoint can't be used to probe
    // which emails are registered.
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (user?.email) {
      const raw = await createResetToken(normalized);
      const link = `${originFrom(request)}/reset-password?token=${raw}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your DM Global password",
        html: `
          <div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6">
            <p>Hi${user.name ? ` ${escapeHtml(user.name)}` : ""},</p>
            <p>We received a request to reset your DM Global password.
            Click the button below to choose a new one. This link expires in 1 hour.</p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none">Reset password</a>
            </p>
            <p style="font-size:13px;color:#666">If the button doesn't work, paste this link into your browser:<br>
            <a href="${link}">${escapeHtml(link)}</a></p>
            <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          </div>`,
      });
    }

    return success({
      sent: true,
      message: "If an account exists for that email, a reset link is on its way.",
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Enter a valid email"
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return failure("VALIDATION_ERROR", message, 400);
  }
}
