// Pure data — safe to import from client components (no server deps).
// Any OpenAI-compatible provider works via base URL + key + model.

export type ProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  defaultEmbedding: string;
  /** Whether the provider exposes an OpenAI-compatible /embeddings endpoint. */
  supportsEmbeddings: boolean;
  keyHint: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    defaultEmbedding: "text-embedding-3-small",
    supportsEmbeddings: true,
    keyHint: "sk-...",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    defaultEmbedding: "",
    supportsEmbeddings: false,
    keyHint: "sk-or-...",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    defaultEmbedding: "text-embedding-004",
    supportsEmbeddings: true,
    keyHint: "AIza...",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    defaultEmbedding: "",
    supportsEmbeddings: false,
    keyHint: "gsk_...",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    defaultModel: "",
    defaultEmbedding: "",
    supportsEmbeddings: true,
    keyHint: "your API key",
  },
];

export const DEFAULT_PROVIDER_ID = "openai";

export function findPreset(id: string | undefined | null): ProviderPreset {
  return (
    PROVIDER_PRESETS.find((p) => p.id === id) ??
    PROVIDER_PRESETS.find((p) => p.id === DEFAULT_PROVIDER_ID)!
  );
}
