"use client";

import { FormEvent, useState } from "react";

type LlmView = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  embeddingModel: string;
  hasKey: boolean;
  keyMasked: string | null;
};

export function LlmForm({ initial }: { initial: LlmView }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [embeddingModel, setEmbeddingModel] = useState(initial.embeddingModel);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initial.hasKey);
  const [keyMasked, setKeyMasked] = useState(initial.keyMasked);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        enabled,
        baseUrl,
        model,
        embeddingModel,
      };
      // Only send apiKey when the user typed something (keeps the stored key).
      if (apiKey.trim() !== "") body.apiKey = apiKey.trim();

      const res = await fetch("/api/account/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Save failed");

      setApiKey("");
      setHasKey(json.data.hasKey);
      setKeyMasked(json.data.keyMasked);
      setMessage({ ok: true, text: "LLM settings saved." });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setLoading(false);
    }
  }

  async function clearKey() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed");
      setApiKey("");
      setHasKey(false);
      setKeyMasked(null);
      setMessage({ ok: true, text: "Key removed. Searches use the shared LLM." });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2";
  const labelCls = "block text-xs font-medium text-muted";

  return (
    <form onSubmit={save} className="mt-8 space-y-6">
      {message && (
        <p
          className={`rounded-sm border px-3 py-2 text-sm ${
            message.ok
              ? "border-accent/40 bg-accent/10 text-primary"
              : "border-border bg-card text-muted"
          }`}
        >
          {message.text}
        </p>
      )}

      <label className="flex items-center justify-between gap-4 rounded-sm border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium text-primary">
          Use my LLM for my requests
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--accent,#b08d57)]"
        />
      </label>

      <div>
        <label htmlFor="apiKey" className={labelCls}>
          API key {hasKey ? <span className="text-muted">(saved: {keyMasked})</span> : null}
        </label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? "Enter a new key to replace" : "sk-…"}
          className={`mt-1 ${field}`}
          autoComplete="off"
        />
        {hasKey ? (
          <button
            type="button"
            onClick={clearKey}
            disabled={loading}
            className="mt-2 text-xs text-muted hover:text-primary"
          >
            Remove saved key
          </button>
        ) : null}
      </div>

      <div>
        <label htmlFor="baseUrl" className={labelCls}>Base URL</label>
        <input id="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className={`mt-1 ${field}`} />
      </div>
      <div>
        <label htmlFor="model" className={labelCls}>Model</label>
        <input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4.1-mini" className={`mt-1 ${field}`} />
      </div>
      <div>
        <label htmlFor="embeddingModel" className={labelCls}>Embedding model</label>
        <input id="embeddingModel" value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} placeholder="text-embedding-3-small" className={`mt-1 ${field}`} />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save LLM settings"}
      </button>
    </form>
  );
}
