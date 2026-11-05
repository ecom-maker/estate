"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

/**
 * Whether a nav item matches the current route. "/" is active only on the exact
 * home path; every other item is active on its own page and any page beneath it
 * (e.g. "/projects" stays lit on "/projects/damac-bay-2").
 */
export function isNavActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop primary nav links with an active-state underline. */
export function NavLinks({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map((item) => {
        const active = isNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative text-sm font-medium transition ${
              active ? "text-primary" : "text-muted hover:text-primary"
            }`}
          >
            {item.label}
            {active ? (
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-accent"
              />
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
