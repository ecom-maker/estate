import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * MCP API keys, stored (hashed) in the generic `settings` table under
 * key="mcp_api_keys" — no dedicated migration needed. Plaintext keys are shown
 * once at creation and never persisted. Auth is considered ENABLED as soon as
 * at least one active key exists (or MCP_API_KEYS env is set), so creating the
 * first key turns enforcement on.
 */

const SETTING_KEY = "mcp_api_keys";
const PREFIX = "dmg_mcp_";

export type StoredKey = {
  id: string;
  label: string;
  hash: string;
  keyPrefix: string; // first chars of the plaintext, for display
  createdAt: string;
  lastUsedAt?: string;
  revoked?: boolean;
};

/** Public view of a key (never includes the hash). */
export type KeyView = Omit<StoredKey, "hash">;

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

async function readStore(): Promise<{ id: string | null; keys: StoredKey[] }> {
  try {
    const row = await prisma.setting.findFirst({
      where: { key: SETTING_KEY, companyId: null },
    });
    const keys = Array.isArray(row?.value) ? (row!.value as StoredKey[]) : [];
    return { id: row?.id ?? null, keys };
  } catch {
    return { id: null, keys: [] };
  }
}

async function writeStore(id: string | null, keys: StoredKey[]): Promise<void> {
  const value = keys as unknown as object;
  if (id) {
    await prisma.setting.update({ where: { id }, data: { value: value as never } });
  } else {
    await prisma.setting.create({
      data: { key: SETTING_KEY, companyId: null, value: value as never },
    });
  }
}

function envKeys(): string[] {
  return (process.env.MCP_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** True when auth should be enforced (any active DB key, or env keys set). */
export async function mcpAuthEnabled(): Promise<boolean> {
  if (envKeys().length > 0) return true;
  const { keys } = await readStore();
  return keys.some((k) => !k.revoked);
}

/** Keys for the admin UI (no hashes). */
export async function listMcpKeys(): Promise<KeyView[]> {
  const { keys } = await readStore();
  return keys
    .map(({ hash: _hash, ...rest }) => rest)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Create a key; returns the plaintext ONCE (store only its hash). */
export async function createMcpKey(
  label: string,
): Promise<{ plaintext: string; key: KeyView }> {
  const { id, keys } = await readStore();
  const secret = PREFIX + randomBytes(24).toString("base64url");
  const record: StoredKey = {
    id: randomBytes(8).toString("hex"),
    label: label.trim() || "Untitled key",
    hash: sha256(secret),
    keyPrefix: secret.slice(0, PREFIX.length + 4),
    createdAt: new Date().toISOString(),
  };
  await writeStore(id, [...keys, record]);
  const { hash: _h, ...view } = record;
  return { plaintext: secret, key: view };
}

/** Revoke a key by its id. */
export async function revokeMcpKey(keyId: string): Promise<void> {
  const { id, keys } = await readStore();
  await writeStore(
    id,
    keys.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)),
  );
}

/**
 * Verify a presented key against the DB store (and env fallback). On a DB
 * match, records lastUsedAt (best-effort). Returns a client id for logging.
 */
export async function verifyMcpKey(
  presented: string,
): Promise<{ ok: boolean; clientId: string }> {
  if (!presented) return { ok: false, clientId: "rejected" };

  // Env keys (opaque, no label).
  if (envKeys().includes(presented)) {
    return { ok: true, clientId: `env:${presented.slice(0, 6)}` };
  }

  const { id, keys } = await readStore();
  const hash = sha256(presented);
  const match = keys.find((k) => !k.revoked && k.hash === hash);
  if (!match) return { ok: false, clientId: "rejected" };

  // Best-effort last-used stamp.
  try {
    await writeStore(
      id,
      keys.map((k) =>
        k.id === match.id ? { ...k, lastUsedAt: new Date().toISOString() } : k,
      ),
    );
  } catch {
    // ignore
  }
  return { ok: true, clientId: `key:${match.label}` };
}
