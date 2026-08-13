import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  let cards = [
    { label: "Total properties", value: "—" },
    { label: "Active listings", value: "—" },
    { label: "AI conversations", value: "—" },
    { label: "API sync status", value: "Healthy" },
    { label: "Knowledge documents", value: "—" },
    { label: "AI usage (all)", value: "—" },
  ];

  try {
    const [total, active, conversations, docs, aiLogs] = await Promise.all([
      prisma.property.count({ where: { deletedAt: null } }),
      prisma.property.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.chatSession.count(),
      prisma.knowledgeDocument.count({ where: { deletedAt: null } }),
      prisma.aiLog.count(),
    ]);
    cards = [
      { label: "Total properties", value: String(total) },
      { label: "Active listings", value: String(active) },
      { label: "AI conversations", value: String(conversations) },
      { label: "API sync status", value: "Healthy" },
      { label: "Knowledge documents", value: String(docs) },
      { label: "AI usage (all)", value: String(aiLogs) },
    ];
  } catch {
    // keep placeholders
  }

  const links = [
    ["Properties", "/admin/properties"],
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
        Premium operational dashboard for DMProperties inventory, AI, and sync.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-sm border border-border bg-card p-5"
          >
            <p className="text-xs uppercase tracking-wider text-muted">
              {card.label}
            </p>
            <p className="mt-3 font-serif text-3xl text-primary">{card.value}</p>
          </div>
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
