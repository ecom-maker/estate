import { z } from "zod";
import { failure, success } from "@/lib/api/response";
import { requestOtp } from "@/lib/auth/otp-store";

const schema = z.object({
  phone: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = schema.parse(body);
    const result = requestOtp(phone);
    return success(result);
  } catch (error) {
    return failure(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Invalid request",
      400,
    );
  }
}
