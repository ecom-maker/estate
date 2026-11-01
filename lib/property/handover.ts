/** Human handover label from a property's metadata JSON, e.g. "Sept 2027". */
export function handoverLabel(metadata: unknown): string | null {
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return null;
  const d = new Date(meta.handoverDate);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Sortable handover timestamp (ms) from metadata JSON, or null when absent/unparseable. */
export function handoverMs(metadata: unknown): number | null {
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return null;
  const d = new Date(meta.handoverDate);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Whether a project should still be treated as off-plan for display and
 * classification. A stored `offPlan` flag is overridden to false once the
 * handover date is in the past — a project that was delivered is completed,
 * regardless of a stale import flag (e.g. a 2017 handover still marked
 * off-plan). Records with no handover date keep their stored flag.
 */
export function effectiveOffPlan(offPlan: boolean, metadata: unknown): boolean {
  if (!offPlan) return false;
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return true;
  const d = new Date(meta.handoverDate);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() > Date.now();
}
