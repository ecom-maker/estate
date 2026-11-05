/**
 * DLD transactions API for dmglobal.me.
 *
 * Reads the Cloudflare D1 database `dubai-transactions` (8.08M DLD sale and rent
 * records, 2016-08 to 2026-08, loaded from the Happy Endpoint file) through a D1
 * binding, so the site never needs a Cloudflare API token. Called only by the site
 * (lib/property/market-data.ts) with a shared secret in `x-dld-secret`.
 *
 *   GET /insights?labels=Business%20Bay&beds=2&names=Salva%20The%20Heights|Salva&sub=
 *     labels  DLD community labels (emirate_community), "|"-separated, exact
 *     sub     optional sub_community filter (e.g. "District 11")
 *     beds    optional bedroom count as stored ("0" = studio)
 *     names   optional project-name candidates, matched case-insensitively
 *             against building and sub_community (villa projects are recorded
 *             by sub_community, e.g. "Salva", towers by building)
 *
 * Returns three scopes: `project` (names matched, same beds), `sameBed`
 * (community, same beds) and `all` (community, all sizes). Each has the latest
 * 14 sales and rentals with a usable area, monthly mean AED/sqft over the last
 * five years, and the five-year counts. Responses are cached for 24 hours.
 *
 * Deploy: scripts/deploy_dld_worker.py in the real-estate-query-project repo.
 */

const SQFT_PER_SQM = 10.7639;
const LATEST = 14;
const CACHE_SECONDS = 86400;

function fiveYearsAgo() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function list(param) {
  return (param || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function scope(db, where, args, since) {
  const latest = (purpose) =>
    db
      .prepare(
        `SELECT transacted_on d, amount_aed a, area_sqm s, monthly_rent_aed r
           FROM market_transactions
          WHERE ${where} AND purpose = ? AND area_sqm > 0
                AND (amount_aed > 0 OR monthly_rent_aed > 0)
          ORDER BY transacted_on DESC LIMIT ${LATEST}`,
      )
      .bind(...args, purpose)
      .all();
  const monthly = (purpose) =>
    db
      .prepare(
        `SELECT substr(transacted_on, 1, 7) m, COUNT(*) n,
                ROUND(AVG(amount_aed / (area_sqm * ${SQFT_PER_SQM}))) v
           FROM market_transactions
          WHERE ${where} AND purpose = ? AND transacted_on >= ?
                AND amount_aed > 0 AND area_sqm > 0
          GROUP BY m ORDER BY m`,
      )
      .bind(...args, purpose, since)
      .all();
  const [ls, lr, ms, mr] = await Promise.all([
    latest("for-sale"),
    latest("for-rent"),
    monthly("for-sale"),
    monthly("for-rent"),
  ]);
  const count = (rows) => rows.reduce((t, r) => t + r.n, 0);
  return {
    sales: { latest: ls.results, monthly: ms.results, count: count(ms.results) },
    rentals: { latest: lr.results, monthly: mr.results, count: count(mr.results) },
  };
}

async function insights(db, url) {
  const labels = list(url.searchParams.get("labels"));
  if (!labels.length) return { error: "labels required" };
  const sub = url.searchParams.get("sub") || null;
  const beds = url.searchParams.get("beds");
  const names = list(url.searchParams.get("names")).map((n) => n.toLowerCase());
  const since = fiveYearsAgo();

  const inLabels = `emirate_community IN (${labels.map(() => "?").join(",")})`;
  const base = sub ? `${inLabels} AND sub_community = ?` : inLabels;
  const baseArgs = sub ? [...labels, sub] : labels;
  const bedsWhere = beds !== null && beds !== "" ? " AND bedrooms = ?" : "";
  const bedsArgs = bedsWhere ? [beds] : [];

  const jobs = [
    scope(db, base + bedsWhere, [...baseArgs, ...bedsArgs], since),
    scope(db, base, baseArgs, since),
  ];
  if (names.length) {
    const ph = names.map(() => "?").join(",");
    jobs.push(
      scope(
        db,
        `${base}${bedsWhere} AND (lower(building) IN (${ph}) OR lower(sub_community) IN (${ph}))`,
        [...baseArgs, ...bedsArgs, ...names, ...names],
        since,
      ),
    );
  }
  const [sameBed, all, project] = await Promise.all(jobs);
  return { since, sameBed, all, project: project ?? null };
}

const worker = {
  async fetch(request, env, ctx) {
    if (request.headers.get("x-dld-secret") !== env.SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/insights") return new Response("not found", { status: 404 });

    const cache = caches.default;
    const key = new Request(url.toString(), { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return hit;

    let body;
    try {
      body = await insights(env.DB, url);
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
    const res = Response.json(body, {
      status: body.error ? 400 : 200,
      headers: { "cache-control": `public, max-age=${CACHE_SECONDS}` },
    });
    if (!body.error) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};

export default worker;
