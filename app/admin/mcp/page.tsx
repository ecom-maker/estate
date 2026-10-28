import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/check";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { listMcpKeys, mcpAuthEnabled } from "@/lib/mcp/keys";
import { getMcpUsage } from "@/lib/mcp/usage";
import { KeyManager } from "./key-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "MCP server" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl text-primary">{value}</p>
    </div>
  );
}

export default async function AdminMcpPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
  if (!isSuperAdmin(roles)) notFound();

  const [keys, enabled, usage] = await Promise.all([
    listMcpKeys(),
    mcpAuthEnabled(),
    getMcpUsage(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-28 md:px-10">
      <Link href="/admin" className="text-xs text-muted hover:text-primary">
        ← Back to admin
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Company Admin
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">MCP server</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Model Context Protocol endpoint at{" "}
        <code className="text-primary">{SITE_URL}/api/mcp</code>. Auth is{" "}
        <span className={enabled ? "text-green-700" : "text-amber-700"}>
          {enabled ? "enabled (API key required)" : "open (no key required)"}
        </span>
        . Create a key below to turn enforcement on.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Tool calls (all time)" value={String(usage.total)} />
        <Stat label="Last 7 days" value={String(usage.last7d)} />
        <Stat label="Errors (7 days)" value={String(usage.errors7d)} />
      </div>

      <h2 className="mt-12 font-serif text-2xl text-primary">API keys</h2>
      <p className="mt-1 text-sm text-muted">
        Issue one key per consumer so usage is attributable and revocable.
      </p>
      <div className="mt-4">
        <KeyManager keys={keys} />
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl text-primary">Calls by tool</h2>
          {usage.byTool.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No calls yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {usage.byTool.map((t) => (
                <li
                  key={t.tool}
                  className="flex justify-between border-b border-border/60 py-1.5"
                >
                  <span className="text-primary">{t.tool}</span>
                  <span className="text-muted">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-serif text-2xl text-primary">Calls by client</h2>
          {usage.byClient.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No calls yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {usage.byClient.map((c) => (
                <li
                  key={c.client}
                  className="flex justify-between border-b border-border/60 py-1.5"
                >
                  <span className="text-primary">{c.client}</span>
                  <span className="text-muted">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {usage.recent.length > 0 ? (
        <>
          <h2 className="mt-12 font-serif text-2xl text-primary">Recent calls</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Tool</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">ms</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-2 pr-4 text-muted">
                      {new Date(r.at).toLocaleString("en-GB")}
                    </td>
                    <td className="py-2 pr-4 text-primary">{r.tool}</td>
                    <td className="py-2 pr-4 text-muted">{r.client}</td>
                    <td className="py-2 pr-4">
                      {r.ok ? (
                        <span className="text-green-700">ok</span>
                      ) : (
                        <span className="text-red-600">error</span>
                      )}
                    </td>
                    <td className="py-2 text-muted">{r.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
