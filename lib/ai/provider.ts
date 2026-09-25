import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";

export type LLMConfig = {
  apiKey: string;
  /** Base URL with no trailing slash, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  model: string;
  embeddingModel: string;
};

function stripSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Read the encrypted API key from settings (new key, falling back to legacy). */
async function resolveStoredKey(): Promise<string | null> {
  for (const key of ["llm_api_key", "openai_api_key"]) {
    try {
      const row = await prisma.aiSetting.findUnique({ where: { key } });
      const encrypted = (row?.value as { encrypted?: string } | null)?.encrypted;
      if (encrypted) {
        const decrypted = decryptSecret(encrypted);
        if (decrypted) return decrypted;
      }
    } catch {
      // try next / ignore
    }
  }
  return null;
}

/**
 * Resolve the active LLM provider config from env (highest priority) or the
 * admin-configured, encrypted settings. Works with any OpenAI-compatible
 * provider (OpenAI, OpenRouter, Gemini compat, Groq, custom). Returns null when
 * nothing is configured, so callers fall back to deterministic behavior.
 */
export async function resolveLLMConfig(): Promise<LLMConfig | null> {
  const envKey =
    process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim();
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: stripSlash(
        process.env.LLM_BASE_URL?.trim() ||
          process.env.OPENAI_BASE_URL?.trim() ||
          "https://api.openai.com/v1",
      ),
      model:
        process.env.LLM_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-4.1-mini",
      embeddingModel:
        process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    };
  }

  try {
    const llm = await prisma.aiSetting.findUnique({ where: { key: "llm" } });
    const cfg = (llm?.value ?? {}) as {
      baseUrl?: string;
      model?: string;
      embeddingModel?: string;
      enabled?: boolean;
    };
    if (cfg.enabled === false) return null;

    const apiKey = await resolveStoredKey();
    if (!apiKey) return null;

    return {
      apiKey,
      baseUrl: stripSlash(cfg.baseUrl || "https://api.openai.com/v1"),
      model: cfg.model || "gpt-4.1-mini",
      embeddingModel: cfg.embeddingModel || "text-embedding-3-small",
    };
  } catch {
    return null;
  }
}
