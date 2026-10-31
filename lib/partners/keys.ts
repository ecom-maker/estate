import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { kvGet, kvSet } from "@/lib/settings/kv";

/**
 * Partner API keys for the inbound listing-ingestion API. Each key belongs to a
 * company; listings submitted with it are attributed to that partner (the
 * Property.source column = "partner:<partnerId>"), so they can be filtered,
 * reviewed and revoked per partner. Keys are stored hashed in the settings KV
 * (no migration); the plaintext is shown once at creation.
 */

const SETTING_KEY = "partner_api_keys";
const PREFIX = "dmg_partner_";

export type PartnerKey = {
  id: string;
  company: string;
  partnerId: string; // stable slug used as the listing source
  hash: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  revoked?: boolean;
};

export type PartnerKeyView = Omit<PartnerKey, "hash">;

export function partnerSlug(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "partner";
}

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

async function read(): Promise<PartnerKey[]> {
  return kvGet<PartnerKey[]>(SETTING_KEY, []);
}

export async function listPartnerKeys(): Promise<PartnerKeyView[]> {
  const keys = await read();
  return keys
    .map(({ hash: _h, ...rest }) => rest)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createPartnerKey(
  company: string,
): Promise<{ plaintext: string; key: PartnerKeyView }> {
  const keys = await read();
  const secret = PREFIX + randomBytes(24).toString("base64url");
  const record: PartnerKey = {
    id: randomBytes(8).toString("hex"),
    company: company.trim(),
    partnerId: partnerSlug(company),
    hash: sha256(secret),
    keyPrefix: secret.slice(0, PREFIX.length + 4),
    createdAt: new Date().toISOString(),
  };
  await kvSet(SETTING_KEY, [...keys, record].slice(-500));
  const { hash: _h, ...view } = record;
  return { plaintext: secret, key: view };
}

export async function revokePartnerKey(keyId: string): Promise<void> {
  const keys = await read();
  await kvSet(
    SETTING_KEY,
    keys.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)),
  );
}

/** Verify a presented key; on match, records lastUsedAt (best-effort). */
export async function verifyPartnerKey(
  presented: string,
): Promise<{ partnerId: string; company: string } | null> {
  if (!presented) return null;
  const keys = await read();
  const hash = sha256(presented);
  const match = keys.find((k) => !k.revoked && k.hash === hash);
  if (!match) return null;
  try {
    await kvSet(
      SETTING_KEY,
      keys.map((k) =>
        k.id === match.id ? { ...k, lastUsedAt: new Date().toISOString() } : k,
      ),
    );
  } catch {
    // ignore
  }
  return { partnerId: match.partnerId, company: match.company };
}
