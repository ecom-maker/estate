import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isMockOtp, sendOtp, type OtpChannel } from "@/lib/auth/otp-senders";

/**
 * One-time sign-in codes by phone, kept in the database (serverless instances
 * don't share memory). Only an HMAC of the code is stored; a code expires
 * after 10 minutes and is locked after 5 wrong tries.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Don't resend to the same number more often than this. */
const RESEND_AFTER_MS = 30 * 1000;
const MOCK_CODE = "000000";

/** "+971 50-123 4567" → "+971501234567". */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function hashCode(phone: string, code: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-otp-secret";
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export type RequestOtpResult =
  | { sent: true; channel: OtpChannel; mock: boolean }
  | { sent: false; reason: "too_soon" | "unavailable" | "send_failed" };

export async function requestOtp(phone: string, channel: OtpChannel): Promise<RequestOtpResult> {
  const normalized = normalizePhone(phone);
  const mock = isMockOtp();

  const existing = await prisma.otpCode.findUnique({ where: { phone: normalized } });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_AFTER_MS) {
    return { sent: false, reason: "too_soon" };
  }

  const code = mock ? MOCK_CODE : String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = {
    codeHash: hashCode(normalized, code),
    channel,
    attempts: 0,
    expiresAt: new Date(Date.now() + TTL_MS),
    createdAt: new Date(),
  };
  await prisma.otpCode.upsert({
    where: { phone: normalized },
    update: data,
    create: { phone: normalized, ...data },
  });

  if (mock) {
    console.info(`[OTP:mock] ${normalized} => ${code}`);
    return { sent: true, channel, mock: true };
  }
  const result = await sendOtp(channel, normalized, code);
  if (!result.sent) {
    console.error(`[OTP] ${channel} send failed for ${normalized}: ${result.error}`);
    await prisma.otpCode.delete({ where: { phone: normalized } }).catch(() => {});
    return { sent: false, reason: "send_failed" };
  }
  return { sent: true, channel, mock: false };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const entry = await prisma.otpCode.findUnique({ where: { phone: normalized } });
  if (!entry) return false;
  if (Date.now() > entry.expiresAt.getTime() || entry.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.delete({ where: { phone: normalized } }).catch(() => {});
    return false;
  }
  const expected = Buffer.from(entry.codeHash, "hex");
  const given = Buffer.from(hashCode(normalized, code.trim()), "hex");
  const ok = expected.length === given.length && timingSafeEqual(expected, given);
  if (ok) {
    await prisma.otpCode.delete({ where: { phone: normalized } }).catch(() => {});
  } else {
    await prisma.otpCode.update({ where: { phone: normalized }, data: { attempts: { increment: 1 } } });
  }
  return ok;
}
