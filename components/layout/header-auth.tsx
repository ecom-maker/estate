"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

type HeaderAuthProps = {
  variant: "desktop" | "mobile";
};

export function HeaderAuth({ variant }: HeaderAuthProps) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const label = user?.name || user?.email || "Account";

  if (status === "loading") {
    if (variant === "desktop") {
      return (
        <span className="inline-block h-9 w-24 animate-pulse rounded-sm bg-border/60" />
      );
    }
    return <span className="inline-block h-5 w-14 animate-pulse rounded-sm bg-border/60" />;
  }

  if (user) {
    if (variant === "desktop") {
      return (
        <div className="flex items-center gap-3">
          <span className="max-w-[160px] truncate text-sm text-muted" title={label}>
            {label}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-sm border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm font-medium text-primary"
      >
        Sign out
      </button>
    );
  }

  if (variant === "desktop") {
    return (
      <Link
        href="/login"
        className="rounded-sm border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition hover:border-accent hover:text-accent"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link href="/login" className="text-sm font-medium text-primary">
      Sign in
    </Link>
  );
}
