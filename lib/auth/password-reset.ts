import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

// Password-reset tokens are stored in the existing Auth.js `verification_tokens`
// table, namespaced by this identifier prefix so they never collide with any
// email-verification tokens. Only the SHA-256 hash of the token is stored, so a
// database leak can't be used to reset anyone's password.
const PREFIX = "pwdreset:";
const TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a single-use reset token for an email, replacing any outstanding one.
 * Returns the RAW token (to embed in the link). The caller decides whether an
 * account actually exists — this just mints and stores the token.
 */
export async function createResetToken(email: string): Promise<string> {
  const identifier = `${PREFIX}${email}`;
  const raw = randomBytes(32).toString("hex");
  const token = hashToken(raw);
  const expires = new Date(Date.now() + TTL_MS);

  // Invalidate previous reset tokens for this email, then store the new one.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });
  return raw;
}

/**
 * Validate and consume a reset token. Returns the associated email on success
 * (deleting the token so it can't be reused), or null if invalid/expired.
 */
export async function consumeResetToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const token = hashToken(raw);
  try {
    const row = await prisma.verificationToken.findFirst({
      where: { token, identifier: { startsWith: PREFIX } },
    });
    if (!row) return null;

    // Always remove the row once matched (used or expired).
    await prisma.verificationToken.deleteMany({
      where: { identifier: row.identifier },
    });

    if (row.expires.getTime() < Date.now()) return null;
    return row.identifier.slice(PREFIX.length);
  } catch {
    return null;
  }
}
