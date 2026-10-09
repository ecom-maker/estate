import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the otp_codes table.
const rows = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    otpCode: {
      findUnique: async ({ where }: { where: { phone: string } }) => rows.get(where.phone) ?? null,
      upsert: async ({ where, create, update }: { where: { phone: string }; create: object; update: object }) => {
        const prev = rows.get(where.phone);
        rows.set(where.phone, prev ? { ...prev, ...update } : { ...create });
      },
      update: async ({ where, data }: { where: { phone: string }; data: { attempts: { increment: number } } }) => {
        const r = rows.get(where.phone)!;
        r.attempts = (r.attempts as number) + data.attempts.increment;
      },
      delete: async ({ where }: { where: { phone: string } }) => rows.delete(where.phone),
    },
  },
}));

import { normalizePhone, requestOtp, verifyOtp } from "@/lib/auth/otp-store";

describe("otp-store (development mode, code 000000)", () => {
  beforeEach(() => rows.clear());

  it("normalizes numbers", () => {
    expect(normalizePhone("+971 50-123 4567")).toBe("+971501234567");
  });

  it("stores only a hash and verifies once", async () => {
    const r = await requestOtp("+971 50 123 4567", "whatsapp");
    expect(r).toMatchObject({ sent: true, mock: true });
    const stored = rows.get("+971501234567")!;
    expect(stored.codeHash).not.toContain("000000");
    expect(await verifyOtp("+971501234567", "000000")).toBe(true);
    expect(await verifyOtp("+971501234567", "000000")).toBe(false); // used up
  });

  it("locks after 5 wrong tries and refuses quick resends", async () => {
    await requestOtp("+971501234567", "sms");
    expect(await requestOtp("+971501234567", "sms")).toEqual({ sent: false, reason: "too_soon" });
    for (let i = 0; i < 5; i++) expect(await verifyOtp("+971501234567", "123456")).toBe(false);
    expect(await verifyOtp("+971501234567", "000000")).toBe(false);
  });

  it("rejects expired codes", async () => {
    await requestOtp("+971501234567", "whatsapp");
    rows.get("+971501234567")!.expiresAt = new Date(Date.now() - 1000);
    expect(await verifyOtp("+971501234567", "000000")).toBe(false);
  });
});
