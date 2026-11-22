import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { kvGet } from "@/lib/settings/kv";

export const dynamic = "force-dynamic";

/**
 * Bust the "dld" Data Cache tag on demand.
 *
 * Market insights (D1 worker responses, the community max-sale-date lookup, the
 * community rent rows) are cached for a day under the "dld" tag. After a code
 * change to how they're built, or a fresh DLD load, this forces every cached
 * entry to be recomputed on the next request instead of waiting out the day.
 *
 * Gated by the same shared secret the site already uses to talk to the DLD
 * worker (stored in the `dld_worker` setting), so no new credential is needed.
 * It only invalidates a cache tag — no data is read or returned.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const cfg = await kvGet<{ secret?: string } | null>("dld_worker", null);
  const expected = cfg?.secret;
  const provided = request.headers.get("x-dld-secret") ?? "";
  if (!expected || !secretsMatch(provided, expected)) {
    return new Response("forbidden", { status: 403 });
  }
  // { expire: 0 } expires the tag immediately, so the next request recomputes
  // (a blocking cache miss) rather than serving stale once under "max".
  revalidateTag("dld", { expire: 0 });
  return Response.json({ ok: true, revalidated: "dld", at: new Date().toISOString() });
}
