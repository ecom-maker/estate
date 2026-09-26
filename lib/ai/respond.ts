import { resolveLLMConfig } from "@/lib/ai/provider";
import { semanticSearch } from "@/lib/ai/rag";

export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export type CompletionUsage = {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
};

export function chatModel() {
  return process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

/**
 * Pull relevant knowledge-base context for grounding (RAG). Safe: returns an
 * empty string when embeddings/DB are unavailable or nothing is indexed.
 */
export async function gatherKnowledge(query: string, limit = 4): Promise<string> {
  try {
    const rows = (await semanticSearch(query, limit)) as Array<{ content?: string }>;
    return rows
      .map((r) => r.content?.trim())
      .filter((c): c is string => Boolean(c))
      .join("\n---\n");
  } catch {
    return "";
  }
}

/**
 * Stream a grounded LLM response, answering ONLY from the provided context.
 * Tries streaming first, then falls back to a non-streaming completion (some
 * OpenAI-compatible providers, e.g. Gemini, are unreliable with `stream:true`).
 * Returns null when no key is configured or the provider fails, so callers fall
 * back to a deterministic template. `onComplete` receives the full text + usage.
 */
export async function streamGroundedResponse(opts: {
  system: string;
  history: ChatTurn[];
  question: string;
  context: string;
  temperature?: number;
  onComplete?: (fullText: string, usage?: CompletionUsage) => Promise<void> | void;
}): Promise<ReadableStream<Uint8Array> | null> {
  const cfg = await resolveLLMConfig();
  if (!cfg) return null;

  const messages: ChatTurn[] = [
    { role: "system", content: opts.system },
    ...opts.history.slice(-6).map((t) => ({
      role: t.role,
      content: t.content.slice(0, 1500),
    })),
    {
      role: "user",
      content: `${opts.question}\n\n--- Retrieved facts (answer ONLY from these; if something is not here, say it is unavailable) ---\n${opts.context}`,
    },
  ];

  const url = `${cfg.baseUrl}/chat/completions`;
  const headers = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  const temperature = opts.temperature ?? 0.3;
  const encoder = new TextEncoder();

  // --- Attempt streaming ---
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: cfg.model, temperature, stream: true, messages }),
    });
  } catch {
    res = null;
  }

  if (res && res.ok && res.body) {
    const upstream = res.body;
    const decoder = new TextDecoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.getReader();
        let buffer = "";
        let full = "";
        let usage: CompletionUsage = { model: cfg.model };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta: string | undefined = json.choices?.[0]?.delta?.content;
                if (delta) {
                  full += delta;
                  controller.enqueue(encoder.encode(delta));
                }
                if (json.usage) {
                  usage = {
                    model: cfg.model,
                    inputTokens: json.usage.prompt_tokens,
                    outputTokens: json.usage.completion_tokens,
                  };
                }
              } catch {
                // ignore partial / keep-alive lines
              }
            }
          }
        } finally {
          controller.close();
          try {
            await opts.onComplete?.(full, usage);
          } catch {
            // persistence failures must not crash the stream
          }
        }
      },
    });
  }

  // --- Fallback: non-streaming completion ---
  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: cfg.model, temperature, messages }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) return null;
    const usage: CompletionUsage = {
      model: cfg.model,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(content));
        controller.close();
        try {
          await opts.onComplete?.(content, usage);
        } catch {
          // ignore
        }
      },
    });
  } catch {
    return null;
  }
}
