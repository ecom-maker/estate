import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { prisma } from "@/lib/db/prisma";
import { MarkSeen } from "@/components/admin/mark-seen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Sell leads" };

type SellMeta = {
  name?: string;
  contact?: string;
  description?: string;
  submittedAt?: string;
  ip?: string;
};

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SellLeadsPage() {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/sell-leads");
  }

  let rows: { id: string; meta: unknown; createdAt: Date }[] = [];
  try {
    rows = await prisma.auditLog.findMany({
      where: { action: "sell_lead" },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, meta: true, createdAt: true },
    });
  } catch {
    rows = [];
  }

  const leads = rows.map((r) => {
    const m = (r.meta ?? {}) as SellMeta;
    return {
      id: r.id,
      name: m.name ?? "—",
      contact: m.contact ?? "—",
      description: m.description ?? "",
      when: r.createdAt,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <MarkSeen kind="sell" />
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Sell leads
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Sell leads</h1>
      <p className="mt-2 text-sm text-muted">
        {leads.length} “List your property” submission
        {leads.length === 1 ? "" : "s"} from the Sell with us form. Also emailed
        to the sell-leads inbox.
      </p>

      {leads.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No sell leads yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Received</th>
                <th>Name</th>
                <th>Contact</th>
                <th className="px-4">Property description</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {fmtDate(l.when)}
                  </td>
                  <td className="py-3 font-medium text-primary">{l.name}</td>
                  <td className="py-3">
                    {l.contact && l.contact !== "—" ? (
                      <a
                        href={`tel:${l.contact.replace(/\s+/g, "")}`}
                        className="text-accent hover:underline"
                      >
                        {l.contact}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-3 text-primary/90">
                    {l.description || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
