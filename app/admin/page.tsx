export const metadata = { title: "Admin" };

const cards = [
  { label: "Total properties", value: "—" },
  { label: "Active listings", value: "—" },
  { label: "AI conversations", value: "—" },
  { label: "API sync status", value: "Healthy" },
  { label: "Knowledge documents", value: "—" },
  { label: "AI usage (30d)", value: "—" },
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Company Admin
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Overview</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Premium operational dashboard. Metrics populate once the database and
        analytics services are connected.
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

      <nav className="mt-12 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Properties",
          "AI",
          "Knowledge Base",
          "API Connectors",
          "CRM",
          "MLS",
          "Transactions",
          "Analytics",
          "Audit Logs",
          "Settings",
          "Agents",
          "Media",
        ].map((item) => (
          <a
            key={item}
            href={`/admin/${item.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-sm border border-border bg-card px-4 py-3 text-primary transition hover:border-accent"
          >
            {item}
          </a>
        ))}
      </nav>
    </div>
  );
}
