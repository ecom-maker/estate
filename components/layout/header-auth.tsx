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
          <Link
            href="/account"
            className="max-w-[160px] truncate text-sm font-medium text-muted transition hover:text-accent"
            title={`${label} — my profile`}
          >
            {label}
          </Link>
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
      <div className="flex items-center gap-4">
        <Link href="/account" className="text-sm font-medium text-primary">
          Profile
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm font-medium text-primary"
        >
          Sign out
        </button>
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
