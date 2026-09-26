import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "API Connectors" };

export default async function AdminConnectorsPage() {
  try {
    await assertPermission("connectors.view");
  } catch {
    redirect("/login?next=/admin/api-connectors");
  }

  let connectors: Array<{
    id: string;
    name: string;
    type: string;
    baseUrl: string | null;
    syncFrequency: string | null;
    enabled: boolean;
    healthStatus: string;
    credentials: { lastFour: string | null }[];
  }> = [];

  try {
    connectors = await prisma.apiProvider.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      include: { credentials: { select: { lastFour: true }, take: 1 } },
    });
  } catch {
    connectors = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Admin · Connectors
          </p>
          <h1 className="mt-3 font-serif text-4xl text-primary">
            API Connectors
          </h1>
          <p className="mt-2 text-sm text-muted">
            Configure data-source APIs (CRM, MLS, transactions, …). Change the
            base URL and key here whenever you switch providers.
          </p>
        </div>
        <Link
          href="/admin/api-connectors/new"
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          + New connector
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Type</th>
              <th>Base URL</th>
              <th>Sync</th>
              <th>Key</th>
              <th>Enabled</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.id} className="border-t border-border align-top">
                <td className="px-4 py-3 text-primary">{c.name}</td>
                <td>{c.type}</td>
                <td className="max-w-[240px] truncate text-muted">
                  {c.baseUrl ?? "—"}
                </td>
                <td className="text-muted">{c.syncFrequency ?? "—"}</td>
                <td className="text-muted">
                  {c.credentials[0]?.lastFour
                    ? `••••${c.credentials[0].lastFour}`
                    : "—"}
                </td>
                <td>
                  <span
                    className={
                      c.enabled ? "text-green-600" : "text-muted"
                    }
                  >
                    {c.enabled ? "On" : "Off"}
                  </span>
                </td>
                <td className="px-4">
                  <Link
                    href={`/admin/api-connectors/${c.id}/edit`}
                    className="font-medium text-accent hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {connectors.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={7} className="px-4 py-6 text-muted">
                  No connectors yet.{" "}
                  <Link
                    href="/admin/api-connectors/new"
                    className="text-accent hover:underline"
                  >
                    Add your first one
                  </Link>
                  . Sync runs via <code className="text-primary">POST /api/sync</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
