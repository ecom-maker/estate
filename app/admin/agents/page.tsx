import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin AI Agents" };

/** Top keys of a { key: count } JSON blob, most frequent first. */
function topKeys(raw: unknown, n = 3): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, number>)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export default async function AdminAgentsPage() {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/agents");
  }

  let agents: Awaited<ReturnType<typeof prisma.agentContact.findMany>> = [];
  let unavailable = false;
  try {
    agents = await prisma.agentContact.findMany({
      orderBy: { lastInteractionAt: "desc" },
      take: 200,
    });
  } catch {
    // Table not migrated yet on this database.
    unavailable = true;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Agent CRM
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">AI agents</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Personal and partner AI agents that queried the portal through its agent endpoint. Agents
        find it from the{" "}
        <Link href="/.well-known/agent-card.json" className="text-accent hover:underline">
          Agent Card
        </Link>{" "}
        and call {SITE_URL}/api/a2a. Unnamed agents are grouped by their browser signature.
      </p>

      {unavailable ? (
        <p className="mt-6 rounded-sm border border-border bg-card px-4 py-3 text-sm text-muted">
          The agent_contacts table isn&apos;t in this database yet. Apply the latest Prisma
          migration to start recording agents.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[1040px] text-left text-sm [&_td]:px-3 [&_th]:px-3 [&_th]:whitespace-nowrap">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Agent</th>
              <th>Owner</th>
              <th>First contact</th>
              <th>Last interaction</th>
              <th className="text-right">Queries</th>
              <th className="text-right">Listings sent</th>
              <th className="text-right">Viewed</th>
              <th className="pl-4">Preferred areas</th>
              <th>Skills used</th>
              <th className="px-4">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <div className="text-primary">{a.name ?? a.agentId}</div>
                  {a.name ? <div className="text-[11px] text-muted">{a.agentId}</div> : null}
                  {a.userAgent ? (
                    <div className="max-w-[220px] truncate text-[11px] text-muted" title={a.userAgent}>
                      {a.userAgent}
                    </div>
                  ) : null}
                </td>
                <td className="py-3">{a.owner ?? "—"}</td>
                <td className="py-3 whitespace-nowrap text-muted">{when(a.firstContactAt)}</td>
                <td className="py-3 whitespace-nowrap text-muted">{when(a.lastInteractionAt)}</td>
                <td className="py-3 text-right">{a.queries}</td>
                <td className="py-3 text-right">{a.propertiesRequested}</td>
                <td className="py-3 text-right">{a.propertiesViewed}</td>
                <td className="py-3 pl-4">{topKeys(a.preferredAreas).join(", ") || "—"}</td>
                <td className="min-w-[200px] py-3 text-xs text-muted">{topKeys(a.skillsUsed, 4).join(", ") || "—"}</td>
                <td className="px-4 py-3 capitalize">{a.trustRelationship}</td>
              </tr>
            ))}
            {!agents.length && !unavailable ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted">
                  No agents have queried the portal yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
