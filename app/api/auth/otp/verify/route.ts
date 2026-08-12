import { z } from "zod";
import { failure, success } from "@/lib/api/response";
import { verifyOtp } from "@/lib/auth/otp-store";

const schema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code } = schema.parse(body);
    const valid = verifyOtp(phone, code);
    if (!valid) {
      return failure("INVALID_OTP", "Invalid or expired code", 401);
    }
    return success({ verified: true, phone });
  } catch (error) {
    return failure(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Invalid request",
      400,
    );
  }
}
