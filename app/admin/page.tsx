import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  // Each card links to the view that explains its number.
  let cards: { label: string; value: string; href: string }[] = [
    { label: "Properties", value: "—", href: "/admin/properties?filter=ready" },
    { label: "Projects (off-plan)", value: "—", href: "/admin/properties?filter=offplan" },
    { label: "Active listings", value: "—", href: "/admin/properties?filter=active" },
    { label: "AI conversations", value: "—", href: "/admin/ai" },
    { label: "API sync status", value: "Healthy", href: "/admin/api-connectors" },
    { label: "Knowledge documents", value: "—", href: "/admin/knowledge-base" },
    { label: "AI usage (all)", value: "—", href: "/admin/ai" },
  ];

  try {
    const [properties, projects, active, conversations, docs, aiLogs] =
      await Promise.all([
        prisma.property.count({ where: { deletedAt: null, offPlan: false } }),
        prisma.property.count({ where: { deletedAt: null, offPlan: true } }),
        prisma.property.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.chatSession.count(),
        prisma.knowledgeDocument.count({ where: { deletedAt: null } }),
        prisma.aiLog.count(),
      ]);
    cards = [
      { label: "Properties", value: String(properties), href: "/admin/properties?filter=ready" },
      { label: "Projects (off-plan)", value: String(projects), href: "/admin/properties?filter=offplan" },
      { label: "Active listings", value: String(active), href: "/admin/properties?filter=active" },
      { label: "AI conversations", value: String(conversations), href: "/admin/ai" },
      { label: "API sync status", value: "Healthy", href: "/admin/api-connectors" },
      { label: "Knowledge documents", value: String(docs), href: "/admin/knowledge-base" },
      { label: "AI usage (all)", value: String(aiLogs), href: "/admin/ai" },
    ];
  } catch {
    // keep placeholders
  }

  const links = [
    ["Properties", "/admin/properties"],
    ["Leads", "/admin/leads"],
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
            <p className="flex items-center justify-between text-xs uppercase tracking-wider text-muted">
              {card.label}
              <span
                aria-hidden
                className="text-accent opacity-0 transition group-hover:opacity-100"
              >
                →
              </span>
            </p>
            <p className="mt-3 font-serif text-3xl text-primary">{card.value}</p>
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
