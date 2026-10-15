/**
 * Display label for a community, with its emirate appended (e.g.
 * "Al Zorah City, Ajman", "JVC (Jumeirah Village Circle), Dubai"). The emirate
 * is skipped when the name already contains it ("Downtown Dubai") or when it's
 * unknown.
 */
export function communityLabel(
  name: string | null | undefined,
  emirate: string | null | undefined,
  fallback = "Dubai",
): string {
  const n = name?.trim();
  const e = emirate?.trim();
  if (!n) return e || fallback;
  if (!e) return n;
  return n.toLowerCase().includes(e.toLowerCase()) ? n : `${n}, ${e}`;
}
