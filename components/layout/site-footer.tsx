import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac/check";

export async function SiteFooter() {
  const session = await auth();
  const showAdmin = isAdmin(
    (session?.user as { roles?: string[] } | undefined)?.roles,
  );

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="font-serif text-lg text-primary">
            <span className="text-accent">DM</span> Global
          </p>
          <p className="mt-1 text-sm text-muted">
            Quiet luxury. Conversational discovery.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-muted">
          <Link href="/search" className="hover:text-primary">
            Search
          </Link>
          {showAdmin ? (
            <Link href="/admin" className="hover:text-primary">
              Admin
            </Link>
          ) : null}
          <Link href="/docs" className="hover:text-primary">
            Docs
          </Link>
        </div>
      </div>
    </footer>
  );
}
