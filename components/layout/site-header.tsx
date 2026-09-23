import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth/actions";

const nav = [
  { href: "/search", label: "Search" },
  { href: "/properties", label: "Properties" },
  { href: "/agent", label: "Agent" },
  { href: "/admin", label: "Admin" },
];

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const label = user?.name || user?.email || "Account";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-primary"
          aria-label="DMProperties AI home"
        >
          <span className="text-accent">DM</span>Properties
          <span className="ml-1 align-super text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-accent">
            AI
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted transition hover:text-primary"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="max-w-[160px] truncate text-sm text-muted" title={label}>
                {label}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-sm border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:border-accent hover:text-accent"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-sm border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:border-accent hover:text-accent"
            >
              Sign in
            </Link>
          )}
        </nav>

        {user ? (
          <form className="md:hidden" action={signOutAction}>
            <button type="submit" className="text-sm font-medium text-primary">
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-primary md:hidden"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
