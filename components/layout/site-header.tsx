import Link from "next/link";
import { HeaderAuth } from "@/components/layout/header-auth";
import { MobileNav } from "@/components/layout/mobile-nav";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac/check";

const baseNav = [
  { href: "/search", label: "Search" },
  { href: "/properties", label: "Properties" },
  { href: "/projects", label: "Projects" },
  { href: "/agent", label: "Agent" },
];

export async function SiteHeader() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
  // Admin link is only shown to staff admins — customers/agents never see it.
  const nav = isAdmin(roles)
    ? [...baseNav, { href: "/admin", label: "Admin" }]
    : baseNav;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="-translate-y-[1cm] font-serif text-xl tracking-tight text-primary"
          aria-label="DM Global home"
        >
          <span className="text-accent">DM</span> Global
          <span className="ml-1 align-super text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-accent">
            Luxury
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
          <HeaderAuth variant="desktop" />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <HeaderAuth variant="mobile" />
          <MobileNav nav={nav} />
        </div>
      </div>
    </header>
  );
}
