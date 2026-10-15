import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { countContacts } from "@/lib/admin/contacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

type Card = { label: string; value: string; href: string; alert?: boolean };

export default async function AdminPage() {
  // "Seen" markers set when an admin opens the Leads / Sell leads pages.
  const cookieStore = await cookies();
  const seenLeads = Number(cookieStore.get("leads_seen_at")?.value ?? 0);
  const seenSell = Number(cookieStore.get("sell_leads_seen_at")?.value ?? 0);

  // Each card links to the view that explains its number.
  let cards: Card[] = [
    { label: "Leads", value: "—", href: "/admin/leads" },
    { label: "Projects (off-plan)", value: "—", href: "/admin/properties?filter=offplan" },
    { label: "Active listings", value: "—", href: "/admin/properties?filter=active" },
    { label: "Sell leads", value: "—", href: "/admin/sell-leads" },
    { label: "API sync status", value: "Healthy", href: "/admin/api-connectors" },
    { label: "Knowledge documents", value: "—", href: "/admin/knowledge-base" },
    { label: "AI usage (all)", value: "—", href: "/admin/ai" },
    { label: "Contacts", value: "—", href: "/admin/contacts" },
    { label: "Calendar", value: "Viewings", href: "/admin/calendar" },
  ];

  try {
    const [
      projects,
      active,
      docs,
      aiLogs,
      contacts,
      leadsCount,
      newestLead,
      sellCount,
      newestSell,
    ] = await Promise.all([
      prisma.property.count({ where: { deletedAt: null, offPlan: true } }),
      prisma.property.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.knowledgeDocument.count({ where: { deletedAt: null } }),
      prisma.aiLog.count(),
      countContacts(),
      prisma.lead.count(),
      prisma.lead.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.auditLog.count({ where: { action: "sell_lead" } }),
      prisma.auditLog.findFirst({
        where: { action: "sell_lead" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    // Red until the admin opens the respective page (newest arrival > last seen).
    const leadsNew = newestLead ? newestLead.createdAt.getTime() > seenLeads : false;
    const sellNew = newestSell ? newestSell.createdAt.getTime() > seenSell : false;
    cards = [
      { label: "Leads", value: String(leadsCount), href: "/admin/leads", alert: leadsNew },
      { label: "Projects (off-plan)", value: String(projects), href: "/admin/properties?filter=offplan" },
      { label: "Active listings", value: String(active), href: "/admin/properties?filter=active" },
      { label: "Sell leads", value: String(sellCount), href: "/admin/sell-leads", alert: sellNew },
      { label: "API sync status", value: "Healthy", href: "/admin/api-connectors" },
      { label: "Knowledge documents", value: String(docs), href: "/admin/knowledge-base" },
      { label: "AI usage (all)", value: String(aiLogs), href: "/admin/ai" },
      { label: "Contacts", value: String(contacts), href: "/admin/contacts" },
      { label: "Calendar", value: "Viewings", href: "/admin/calendar" },
    ];
  } catch {
    // keep placeholders
  }

  const links = [
    ["Projects / Properties", "/admin/properties"],
    ["Units", "/admin/units"],
    ["Contacts", "/admin/contacts"],
    ["Admin contacts", "/admin/users"],
    ["Properties", "/admin/properties?filter=ready"],
    ["AI conversations", "/admin/ai"],
    ["AI agents (CRM)", "/admin/agents"],
    ["AI", "/admin/ai"],
    ["Knowledge Base", "/admin/knowledge-base"],
    ["API Connectors", "/admin/api-connectors"],
    ["Analytics", "/admin/analytics"],
    ["Settings", "/admin"],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Company Admin
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Overview</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Premium operational dashboard for DM Global inventory, AI, and sync.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-sm border border-border bg-card p-5 transition hover:border-accent hover:shadow-sm"
          >
            <p
              className={`flex items-center justify-between text-xs uppercase tracking-wider ${
                card.alert ? "text-red-600" : "text-muted"
              }`}
            >
              {card.label}
              {card.alert ? (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  New
                </span>
              ) : (
                <span
                  aria-hidden
                  className="text-accent opacity-0 transition group-hover:opacity-100"
                >
                  →
                </span>
              )}
            </p>
            <p
              className={`mt-3 font-serif text-3xl ${
                card.alert ? "text-red-600" : "text-primary"
              }`}
            >
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <nav className="mt-12 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([label, href]) => (
          <Link
            key={href + label}
            href={href}
            className="rounded-sm border border-border bg-card px-4 py-3 text-primary transition hover:border-accent"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
