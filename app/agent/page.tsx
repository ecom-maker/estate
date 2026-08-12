export const metadata = { title: "Agent" };

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Agent workspace
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Dashboard</h1>
      <p className="mt-2 text-sm text-muted">
        AI search, favorites, saved searches, customers, and chat history.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {["AI Search", "Favorites", "Saved Searches", "Customers", "Appointments", "Chat History"].map(
          (item) => (
            <div
              key={item}
              className="rounded-sm border border-border bg-card p-5"
            >
              <h2 className="font-serif text-xl text-primary">{item}</h2>
              <p className="mt-2 text-sm text-muted">Available after auth & data layers.</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
