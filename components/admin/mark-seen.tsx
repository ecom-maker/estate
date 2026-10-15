"use client";

import { useEffect } from "react";
import { markSeen, type SeenKind } from "@/app/admin/seen-actions";

/**
 * Marks the Leads / Sell leads page as seen for the current user (stored in the
 * DB), so the dashboard tile clears its "new" highlight once viewed.
 */
export function MarkSeen({ kind }: { kind: SeenKind }) {
  useEffect(() => {
    void markSeen(kind);
  }, [kind]);
  return null;
}
