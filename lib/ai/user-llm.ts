import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import type { LLMConfig } from "@/lib/ai/provider";

function stripSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve a specific user's personal ("bring your own") LLM config, or null if
 * they have none / it's disabled / the key can't be decrypted. The returned
 * config is used in place of the company default so usage is billed to them.
 */
export async function resolveUserLLMConfig(
  userId: string | undefined | null,
): Promise<LLMConfig | null> {
  if (!userId) return null;
  try {
    const row = await prisma.userAiSetting.findUnique({ where: { userId } });
    if (!row || !row.enabled || !row.apiKeyEnc) return null;
    const apiKey = decryptSecret(row.apiKeyEnc);
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: stripSlash(row.baseUrl || "https://api.openai.com/v1"),
      model: row.model || "gpt-4.1-mini",
      embeddingModel: row.embeddingModel || "text-embedding-3-small",
    };
  } catch {
    return null;
  }
}

export type UserLLMView = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  embeddingModel: string;
  hasKey: boolean;
  keyMasked: string | null;
};

const DEFAULT_VIEW: UserLLMView = {
  enabled: true,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  embeddingModel: "text-embedding-3-small",
  hasKey: false,
  keyMasked: null,
};

/** Read a user's settings for display (never returns the raw key). */
export async function getUserLLMView(userId: string): Promise<UserLLMView> {
  try {
    const row = await prisma.userAiSetting.findUnique({ where: { userId } });
    const key = row?.apiKeyEnc ? decryptSecret(row.apiKeyEnc) : "";
    return {
      enabled: row?.enabled ?? true,
      baseUrl: row?.baseUrl ?? DEFAULT_VIEW.baseUrl,
      model: row?.model ?? DEFAULT_VIEW.model,
      embeddingModel: row?.embeddingModel ?? DEFAULT_VIEW.embeddingModel,
      hasKey: Boolean(key),
      keyMasked: key ? maskSecret(key) : null,
    };
  } catch {
    // Table not migrated yet / transient DB error — show defaults so the page
    // still renders; saving will surface a clear error until the migration runs.
    return DEFAULT_VIEW;
  }
}

export type UserLLMUpdate = {
  enabled?: boolean;
  baseUrl?: string | null;
  model?: string | null;
  embeddingModel?: string | null;
  /** Plaintext key to store (encrypted). Empty string clears it; undefined keeps it. */
  apiKey?: string | undefined;
};

/** Create or update a user's personal LLM config. */
export async function saveUserLLMConfig(userId: string, update: UserLLMUpdate) {
  const data: {
    enabled?: boolean;
    baseUrl?: string | null;
    model?: string | null;
    embeddingModel?: string | null;
    apiKeyEnc?: string | null;
  } = {};

  if (update.enabled !== undefined) data.enabled = update.enabled;
  if (update.baseUrl !== undefined) data.baseUrl = update.baseUrl?.trim() || null;
  if (update.model !== undefined) data.model = update.model?.trim() || null;
  if (update.embeddingModel !== undefined)
    data.embeddingModel = update.embeddingModel?.trim() || null;
  if (update.apiKey !== undefined) {
    const trimmed = update.apiKey.trim();
    data.apiKeyEnc = trimmed ? encryptSecret(trimmed) : null;
  }

  await prisma.userAiSetting.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      enabled: data.enabled ?? true,
      baseUrl: data.baseUrl ?? null,
      model: data.model ?? null,
      embeddingModel: data.embeddingModel ?? null,
      apiKeyEnc: data.apiKeyEnc ?? null,
    },
  });
}
