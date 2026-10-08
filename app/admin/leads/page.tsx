import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { setLeadStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Leads" };

const KIND_LABEL: Record<string, string> = {
  viewing: "Viewing request",
  callback: "Callback",
  contact_request: "Specialist call",
  brochure: "Brochure",
  human_handoff: "Asked for a human",
  enquiry: "Enquiry",
  sourcing_request: "Sourcing request (AI agent)",
};

/** Requirements the agent saved in discovery, as short "label: value" pairs. */
function requirementPairs(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/leads");
  }
  const { status } = await searchParams;
  const filter = status === "all" ? undefined : (status ?? "new");

  let leads: Awaited<ReturnType<typeof loadLeads>> = [];
  try {
    leads = await loadLeads(filter);
  } catch {
    leads = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">Admin · Leads</p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Leads</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Viewing requests, callbacks and contact requests captured by the AI sales agent. Nothing
        here has been confirmed to the customer — contact them to confirm.
      </p>

      <nav className="mt-6 flex gap-2 text-sm">
        {["new", "contacted", "closed", "all"].map((s) => (
          <Link
            key={s}
            href={`/admin/leads?status=${s}`}
            className={`rounded-sm border px-3 py-1.5 capitalize transition ${
              (filter ?? "all") === s ? "border-accent text-accent" : "border-border text-primary hover:border-accent"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th>Type</th>
              <th>Contact</th>
              <th>Property</th>
              <th>Preferred time</th>
              <th>What they want</th>
              <th className="px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-border align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {lead.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  <div className="text-[11px] uppercase">{lead.channel}</div>
                </td>
                <td className="py-3">
                  {KIND_LABEL[lead.kind] ?? lead.kind}
                  <div className="text-[11px] text-muted">Ref {lead.id.slice(-6).toUpperCase()}</div>
                </td>
                <td className="py-3">
                  <div className="text-primary">{lead.name ?? "—"}</div>
                  {lead.phone ? <div>+{lead.phone}</div> : null}
                  {lead.email ? <div>{lead.email}</div> : null}
                </td>
                <td className="py-3">
                  {lead.property ? (
                    <Link href={`/projects/${lead.property.slug}`} className="text-primary hover:text-accent">
                      {lead.property.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 whitespace-nowrap">
                  {[lead.preferredDate, lead.preferredTime].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="max-w-sm py-3 text-xs text-muted">
                  {requirementPairs(lead.requirements).map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                  {lead.notes ? <div className="mt-1 whitespace-pre-wrap text-primary">{lead.notes}</div> : null}
                  {lead.sessionId ? (
                    <Link href={`/agent/chat-history/${lead.sessionId}`} className="mt-1 inline-block text-accent hover:underline">
                      Conversation
                    </Link>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <form action={setLeadStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={lead.id} />
                    <select
                      name="status"
                      defaultValue={lead.status}
                      className="rounded-sm border border-border bg-card px-2 py-1 text-sm"
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="closed">closed</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-accent hover:underline">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={7} className="px-4 py-6 text-muted">
                  No {filter ?? ""} leads yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function loadLeads(status: string | undefined) {
  return prisma.lead.findMany({
    where: status ? { status } : {},
    include: { property: { select: { title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
