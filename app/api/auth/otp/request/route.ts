import { z } from "zod";
import { failure, success } from "@/lib/api/response";
import { requestOtp } from "@/lib/auth/otp-store";
import { availableOtpChannels, isMockOtp } from "@/lib/auth/otp-senders";
import { phoneError } from "@/lib/validation/phone";
import { rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  phone: z.string().trim().max(30),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`otp:${ip}`, 5, 10 * 60_000).ok) {
    return failure("RATE_LIMITED", "Too many code requests. Try again in a few minutes.", 429);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Enter your phone number.", 400);
  const { phone, channel } = parsed.data;
  const bad = phoneError(phone);
  if (bad) return failure("VALIDATION_ERROR", bad, 400);

  // In production a channel must really be configured; never fall back to a fixed code.
  if (!isMockOtp() && !availableOtpChannels().includes(channel)) {
    return failure(
      "OTP_UNAVAILABLE",
      channel === "whatsapp"
        ? "WhatsApp codes aren't available right now. Try SMS or another sign-in option."
        : "SMS codes aren't available right now. Try WhatsApp or another sign-in option.",
      503,
    );
  }

  try {
    const result = await requestOtp(phone, channel);
    if (result.sent) return success({ sent: true, channel: result.channel, mock: result.mock });
    if (result.reason === "too_soon") {
      return failure("TOO_SOON", "A code was just sent. Wait 30 seconds before asking again.", 429);
    }
    return failure("SEND_FAILED", "We couldn't send the code. Check the number and try again.", 502);
  } catch (error) {
    console.error("[otp] request failed", error);
    return failure("OTP_ERROR", "Couldn't send a code right now. Try again shortly.", 500);
  }
}
