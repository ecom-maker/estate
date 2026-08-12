import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";

describe("secret encryption", () => {
  it("round-trips secrets", () => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const encrypted = encryptSecret("sk-test-secret-key-1234");
    expect(encrypted).not.toContain("sk-test");
    expect(decryptSecret(encrypted)).toBe("sk-test-secret-key-1234");
    expect(maskSecret("sk-test-secret-key-1234")).toMatch(/^sk-•+|sk•+/);
  });
});
