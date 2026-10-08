"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { AuthLink } from "@/components/auth/auth-link";

type NavItem = { href: string; label: string };

export function MobileNav({ nav }: { nav: NavItem[] }) {
  const { data: session, status } = useSession();
  const authed = Boolean(session?.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary outline-none ring-accent transition hover:border-accent focus-visible:ring-2"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-border bg-card shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        >
          <nav className="py-1" aria-label="Site">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-accent/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Auth actions live here only when signed out; signed-in users use
              the avatar menu for profile / sign out. */}
          {status !== "loading" && !authed ? (
            <div className="border-t border-border py-1">
              <AuthLink
                to="/login"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-accent/10"
              >
                Sign in
              </AuthLink>
              <AuthLink
                to="/signup"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
              >
                Sign up
              </AuthLink>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
