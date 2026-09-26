import { redirect } from "next/navigation";
import { AIChat } from "@/components/ai/ai-chat";
import { AiProviderForm } from "@/components/admin/ai-provider-form";
import { PromptEditor } from "@/components/admin/prompt-editor";
import { assertPermission } from "@/lib/rbac/guards";
import { findPreset } from "@/lib/ai/providers";
import { EDITABLE_PROMPTS, getPrompts } from "@/lib/ai/get-prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Control Panel" };

type LlmSetting = {
  provider?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  enabled?: boolean;
  apiKeyConfigured?: boolean;
};

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  try {
    await assertPermission("ai.settings.view");
  } catch {
    redirect("/login?next=/admin/ai");
  }

  const { saved } = await searchParams;

  let llm: LlmSetting = {};
  let logs: {
    id: string;
    feature: string;
    status: string;
    model: string | null;
    totalTokens: number | null;
    createdAt: Date;
  }[] = [];

  try {
    const setting = await prisma.aiSetting.findUnique({ where: { key: "llm" } });
    llm = (setting?.value as LlmSetting) ?? {};
    logs = await prisma.aiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        feature: true,
        status: true,
        model: true,
        totalTokens: true,
        createdAt: true,
      },
    });
  } catch {
    llm = {};
    logs = [];
  }

  const providerLabel = findPreset(llm.provider).label;
  const envKeyActive = Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);

  const promptValues = await getPrompts(EDITABLE_PROMPTS.map((p) => p.key));
  const promptFields = EDITABLE_PROMPTS.map((p) => ({
    key: p.key,
    label: p.label,
    help: p.help,
    value: promptValues[p.key],
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · AI
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">AI Control Panel</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Connect any OpenAI-compatible LLM — OpenAI, OpenRouter, Google Gemini,
        Groq, or a custom endpoint. Keys are encrypted at rest and never
        returned in full.
      </p>

      {saved ? (
        <p className="mt-6 rounded-sm border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Provider settings saved.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-serif text-2xl text-primary">LLM provider</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Active provider</dt>
              <dd>{providerLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Model</dt>
              <dd>{llm.model ?? "gpt-4.1-mini"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">API key</dt>
              <dd>
                {envKeyActive
                  ? "Set via environment"
                  : llm.apiKeyConfigured
                    ? "Configured (encrypted)"
                    : "Not configured"}
              </dd>
            </div>
          </dl>
          {envKeyActive ? (
            <p className="mt-4 rounded-sm border border-border bg-background px-3 py-2 text-xs text-muted">
              An environment key is set, which overrides this panel. Remove{" "}
              <code>OPENAI_API_KEY</code>/<code>LLM_API_KEY</code> to manage the
              provider here.
            </p>
          ) : null}

          <AiProviderForm
            initial={{
              provider: llm.provider,
              baseUrl: llm.baseUrl,
              model: llm.model,
              embeddingModel: llm.embeddingModel,
              apiKeyConfigured: llm.apiKeyConfigured,
            }}
          />
        </section>

        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-serif text-2xl text-primary">Usage</h2>
          {logs.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No AI usage logged yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between border-b border-border py-2"
                >
                  <span>
                    {log.feature} · {log.status}
                    {log.model ? ` · ${log.model}` : ""}
                  </span>
                  <span className="text-muted">{log.totalTokens ?? 0} tok</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-sm border border-border bg-card p-6">
        <h2 className="font-serif text-2xl text-primary">Prompt templates</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Fine-tune how the assistant responds. These override the built-in
          defaults and apply immediately to search and property chat.
        </p>
        <PromptEditor prompts={promptFields} />
      </section>

      <section className="mt-6 rounded-sm border border-border bg-card p-6">
        <h2 className="font-serif text-2xl text-primary">Test prompt</h2>
        <div className="mt-4 max-w-xl">
          <AIChat placeholder="Test the assistant..." />
        </div>
      </section>
    </div>
  );
}
