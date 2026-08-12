import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="font-serif text-lg text-primary">
            <span className="text-accent">DM</span>Properties AI
          </p>
          <p className="mt-1 text-sm text-muted">
            Quiet luxury. Conversational discovery.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-muted">
          <Link href="/search" className="hover:text-primary">
            Search
          </Link>
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>
          <Link href="/docs" className="hover:text-primary">
            Docs
          </Link>
        </div>
      </div>
    </footer>
  );
}
