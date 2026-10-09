import { afterEach, describe, expect, it, vi } from "vitest";
import { availableOtpChannels, isMockOtp } from "@/lib/auth/otp-senders";

afterEach(() => vi.unstubAllEnvs());

const clearProviders = () => {
  for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"]) {
    vi.stubEnv(k, "");
  }
};

describe("otp channels", () => {
  it("never uses the fixed development code in production", () => {
    clearProviders();
    vi.stubEnv("NODE_ENV", "production");
    expect(isMockOtp()).toBe(false);
    expect(availableOtpChannels()).toEqual([]);
  });

  it("offers only the channels whose credentials are set", () => {
    clearProviders();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    expect(availableOtpChannels()).toEqual(["whatsapp"]);
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "x");
    vi.stubEnv("TWILIO_FROM_NUMBER", "+1555");
    expect(availableOtpChannels()).toEqual(["whatsapp", "sms"]);
  });
});
