"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User as UserIcon, Sparkles, ShieldCheck } from "lucide-react";
import { isAdmin } from "@/lib/rbac/check";

type HeaderAuthProps = {
  variant: "desktop" | "mobile";
};

function initialsFrom(name?: string | null, email?: string | null): string {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function Avatar({
  image,
  label,
  size = 36,
}: {
  image?: string | null;
  label: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = image && !failed;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-sm font-semibold text-accent ring-1 ring-border"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImg ? (
        // Plain <img> avoids next/image remote-domain config for Google's CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}

export function HeaderAuth({ variant }: HeaderAuthProps) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const roles = (user as { roles?: string[] } | undefined)?.roles ?? [];
  const admin = isAdmin(roles);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  if (status === "loading") {
    return (
      <span className="inline-block h-9 w-9 animate-pulse rounded-full bg-border/60" />
    );
  }

  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="flex items-center rounded-full outline-none ring-accent transition focus-visible:ring-2"
        >
          <Avatar image={user.image} label={initialsFrom(user.name, user.email)} />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-border bg-card shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar
                image={user.image}
                label={initialsFrom(user.name, user.email)}
                size={40}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">
                  {user.name || "Account"}
                </p>
                {user.email ? (
                  <p className="truncate text-xs text-muted">{user.email}</p>
                ) : null}
              </div>
            </div>

            <nav className="py-1" aria-label="Account">
              <MenuLink href="/account" onClick={() => setOpen(false)}>
                <UserIcon className="h-4 w-4" aria-hidden />
                My profile
              </MenuLink>
              <MenuLink href="/account/llm" onClick={() => setOpen(false)}>
                <Sparkles className="h-4 w-4" aria-hidden />
                My LLM
              </MenuLink>
              {admin ? (
                <MenuLink href="/admin" onClick={() => setOpen(false)}>
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Admin
                </MenuLink>
              ) : null}
            </nav>

            <div className="border-t border-border py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-primary transition hover:bg-accent/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "desktop") {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-sm border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:border-accent hover:text-accent"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/login" className="text-sm font-medium text-primary">
        Sign in
      </Link>
      <Link href="/signup" className="text-sm font-medium text-accent">
        Sign up
      </Link>
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-primary transition hover:bg-accent/10"
    >
      {children}
    </Link>
  );
}
