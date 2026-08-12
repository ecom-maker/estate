import { AIChat } from "@/components/ai/ai-chat";
import { maskSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Control Panel" };

export default async function AdminAiPage() {
  let settings: { key: string; value: unknown }[] = [];
  let logs: { id: string; feature: string; status: string; totalTokens: number | null; createdAt: Date }[] = [];

  try {
    settings = await prisma.aiSetting.findMany({ orderBy: { key: "asc" } });
    logs = await prisma.aiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        feature: true,
        status: true,
        totalTokens: true,
        createdAt: true,
      },
    });
  } catch {
    settings = [];
    logs = [];
  }

  const llm = settings.find((s) => s.key === "llm")?.value as
    | { model?: string; enabled?: boolean; apiKeyConfigured?: boolean }
    | undefined;

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · AI
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">AI Control Panel</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Configure OpenAI models, prompts, embeddings, and usage. API keys are
        encrypted at rest and never returned in full.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-serif text-2xl text-primary">LLM</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Provider</dt>
              <dd>OpenAI</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Model</dt>
              <dd>{llm?.model ?? "gpt-4.1-mini"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Enabled</dt>
              <dd>{llm?.enabled === false ? "No" : "Yes"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">API key</dt>
              <dd>
                {llm?.apiKeyConfigured
                  ? maskSecret("sk-configured-key-1234")
                  : "Not configured"}
              </dd>
            </div>
          </dl>
          <form
            action="/api/admin/ai/settings"
            method="post"
            className="mt-6 space-y-3"
          >
            <label className="block text-xs uppercase tracking-wider text-muted">
              OpenAI API key
              <input
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                className="mt-2 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Save encrypted key
            </button>
          </form>
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
                  </span>
                  <span className="text-muted">
                    {log.totalTokens ?? 0} tok
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-sm border border-border bg-card p-6">
        <h2 className="font-serif text-2xl text-primary">Test prompt</h2>
        <div className="mt-4 max-w-xl">
          <AIChat placeholder="Test the assistant..." />
        </div>
      </section>
    </div>
  );
}
