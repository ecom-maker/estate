"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { authHref, returnToFrom } from "@/lib/auth/return-to";

type AuthLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  to: "/login" | "/signup";
};

/**
 * Sign in / Sign up link that remembers the current page (`?next=`), so the
 * visitor lands back on it afterwards. The rendered href uses the path only;
 * the click adds the live query string (e.g. a search) without needing
 * useSearchParams, which would force a Suspense boundary on every page.
 */
export function AuthLink({ to, onClick, ...props }: AuthLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const href = authHref(to, returnToFrom(pathname, ""));

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const full = authHref(to, returnToFrom(window.location.pathname, window.location.search));
    if (full !== href) {
      e.preventDefault();
      router.push(full);
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
