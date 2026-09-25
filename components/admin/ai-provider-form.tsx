"use client";

import { useState } from "react";
import { PROVIDER_PRESETS, findPreset } from "@/lib/ai/providers";

type Initial = {
  provider?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  apiKeyConfigured?: boolean;
};

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted";

export function AiProviderForm({ initial }: { initial: Initial }) {
  const initProvider = initial.provider ?? "openai";
  const initPreset = findPreset(initProvider);

  const [provider, setProvider] = useState(initProvider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? initPreset.baseUrl);
  const [model, setModel] = useState(initial.model ?? initPreset.defaultModel);
  const [embeddingModel, setEmbeddingModel] = useState(
    initial.embeddingModel ?? initPreset.defaultEmbedding,
  );

  const preset = findPreset(provider);

  function onProviderChange(id: string) {
    setProvider(id);
    if (id !== "custom") {
      const p = findPreset(id);
      setBaseUrl(p.baseUrl);
      setModel(p.defaultModel);
      setEmbeddingModel(p.defaultEmbedding);
    }
  }

  return (
    <form
      action="/api/admin/ai/settings"
      method="post"
      className="mt-6 space-y-4"
    >
      <div>
        <label htmlFor="provider" className={labelClass}>
          Provider
        </label>
        <select
          id="provider"
          name="provider"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className={fieldClass}
        >
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="baseUrl" className={labelClass}>
          Base URL
        </label>
        <input
          id="baseUrl"
          name="baseUrl"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="model" className={labelClass}>
            Model
          </label>
          <input
            id="model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4.1-mini"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="embeddingModel" className={labelClass}>
            Embedding model {preset.supportsEmbeddings ? "" : "(not supported)"}
          </label>
          <input
            id="embeddingModel"
            name="embeddingModel"
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="optional — leave blank to disable RAG embeddings"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="apiKey" className={labelClass}>
          API key{" "}
          {initial.apiKeyConfigured ? "(configured — leave blank to keep)" : ""}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={preset.keyHint}
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-muted">
          Stored encrypted at rest. Works with any OpenAI-compatible provider.
        </p>
      </div>

      <button
        type="submit"
        className="rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Save provider
      </button>
    </form>
  );
}
