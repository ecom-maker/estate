import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { verifyGoogleIdToken } from "@/lib/auth/google-one-tap";

const CLIENT = "123.apps.googleusercontent.com";

async function token(claims: Record<string, unknown>, opts: { iss?: string; aud?: string } = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwt = await new SignJWT({ email: "a@b.com", email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("google-sub-1")
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? CLIENT)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { jwt, publicKey };
}

describe("verifyGoogleIdToken", () => {
  it("accepts a token Google issued for our client", async () => {
    const { jwt, publicKey } = await token({ name: "Jane" });
    const claims = await verifyGoogleIdToken(jwt, CLIENT, publicKey);
    expect(claims.sub).toBe("google-sub-1");
    expect(claims.email).toBe("a@b.com");
  });

  it("rejects a token for another app or from another issuer", async () => {
    const other = await token({}, { aud: "someone-else" });
    await expect(verifyGoogleIdToken(other.jwt, CLIENT, other.publicKey)).rejects.toThrow();
    const forged = await token({}, { iss: "https://evil.example" });
    await expect(verifyGoogleIdToken(forged.jwt, CLIENT, forged.publicKey)).rejects.toThrow();
  });
});
