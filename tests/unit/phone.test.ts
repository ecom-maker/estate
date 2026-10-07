import { describe, expect, it } from "vitest";
import { phoneError } from "@/lib/validation/phone";

describe("phoneError", () => {
  it("accepts common ways of typing a number", () => {
    for (const v of ["+971 50 123 4567", "050-123-4567", "(04) 123 4567", "0501234567", " +44 20 7946 0958 "]) {
      expect(phoneError(v)).toBeNull();
    }
  });

  it("rejects letters and other symbols", () => {
    expect(phoneError("abcdef")).toMatch(/digits only/);
    expect(phoneError("050 123 4567 ext 2")).toMatch(/digits only/);
    expect(phoneError("+971+50")).toMatch(/digits only/);
  });

  it("rejects too few or too many digits", () => {
    expect(phoneError("12345")).toMatch(/too short/);
    expect(phoneError("1234567890123456")).toMatch(/too long/);
  });

  it("asks for a number when empty", () => {
    expect(phoneError("   ")).toMatch(/Enter a contact number/);
  });
});
