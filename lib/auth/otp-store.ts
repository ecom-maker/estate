type OtpEntry = { code: string; expiresAt: number };

const otpStore = new Map<string, OtpEntry>();

export function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "");
}

export function requestOtp(phone: string) {
  const normalized = normalizePhone(phone);
  const provider = process.env.OTP_PROVIDER ?? "mock";
  const code = provider === "mock" ? "000000" : String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  if (provider === "mock" && process.env.NODE_ENV !== "production") {
    console.info(`[OTP:mock] ${normalized} => ${code}`);
  }

  return { sent: true, mock: provider === "mock" };
}

export function verifyOtp(phone: string, code: string) {
  const normalized = normalizePhone(phone);
  const entry = otpStore.get(normalized);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized);
    return false;
  }
  const ok = entry.code === code;
  if (ok) otpStore.delete(normalized);
  return ok;
}
