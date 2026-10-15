"use client";

import { useEffect } from "react";

/**
 * Records the current time in a cookie when an admin opens a page, so the
 * dashboard can tell whether anything newer has arrived since (e.g. the Leads
 * and Sell leads tiles go red until viewed).
 */
export function MarkSeen({ cookie }: { cookie: string }) {
  useEffect(() => {
    try {
      document.cookie = `${cookie}=${Date.now()}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Cookies unavailable — the tile just stays highlighted.
    }
  }, [cookie]);
  return null;
}
