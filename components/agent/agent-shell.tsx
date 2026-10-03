import Link from "next/link";

/** Shared page frame for agent-workspace detail pages. */
export function AgentShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24 md:px-10">
      <Link
        href="/agent"
        className="text-sm text-accent hover:underline"
      >
        ← Agent dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl text-primary">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** Consistent empty-state block. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
