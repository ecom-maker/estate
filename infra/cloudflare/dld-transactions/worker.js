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
 * five years, and the five-year counts. Each answer is stored in the D1 table
 * `mt_cache`, so the aggregation over 8M rows runs once per question.
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

function statements(db, where, args, since) {
  const latest = (purpose) =>
    db
      .prepare(
        `SELECT transacted_on d, amount_aed a, area_sqm s, monthly_rent_aed r, bedrooms b
           FROM market_transactions
          WHERE ${where} AND purpose = ? AND area_sqm > 0
                AND (amount_aed > 0 OR monthly_rent_aed > 0)
          ORDER BY transacted_on DESC LIMIT ${LATEST}`,
      )
      .bind(...args, purpose);
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
      .bind(...args, purpose, since);
  return [latest("for-sale"), latest("for-rent"), monthly("for-sale"), monthly("for-rent")];
}

function toScope([ls, lr, ms, mr]) {
  const count = (rows) => rows.reduce((t, r) => t + r.n, 0);
  return {
    sales: { latest: ls.results, monthly: ms.results, count: count(ms.results) },
    rentals: { latest: lr.results, monthly: mr.results, count: count(mr.results) },
  };
}

/** One D1 batch (one round trip, run in order) per request; one retry on a transient error. */
async function runBatch(db, stmts) {
  try {
    return await db.batch(stmts);
  } catch {
    await new Promise((r) => setTimeout(r, 300));
    return db.batch(stmts);
  }
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

  const stmts = [
    ...statements(db, base + bedsWhere, [...baseArgs, ...bedsArgs], since),
    ...statements(db, base, baseArgs, since),
  ];
  if (names.length) {
    const ph = names.map(() => "?").join(",");
    stmts.push(
      ...statements(
        db,
        `${base}${bedsWhere} AND (lower(building) IN (${ph}) OR lower(sub_community) IN (${ph}))`,
        [...baseArgs, ...bedsArgs, ...names, ...names],
        since,
      ),
    );
  }
  const res = await runBatch(db, stmts);
  return {
    since,
    sameBed: toScope(res.slice(0, 4)),
    all: toScope(res.slice(4, 8)),
    project: names.length ? toScope(res.slice(8, 12)) : null,
  };
}

const worker = {
  async fetch(request, env, ctx) {
    if (request.headers.get("x-dld-secret") !== env.SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/insights") return new Response("not found", { status: 404 });

    // Answers are stored in D1 table `mt_cache` (one row per question), so
    // each heavy aggregation over the 8M rows runs once; every later request
    // is a single-row read. The cache is filled ahead of time by
    // scripts/warm_dld_cache (real-estate-query-project) and cleared when
    // new transactions are loaded (deploy_dld_worker.py --clear-cache).
    const p = url.searchParams;
    const key = ["labels", "sub", "beds", "names"].map((k) => `${k}=${p.get(k) ?? ""}`).join("&");
    const headers = { "cache-control": `public, max-age=${CACHE_SECONDS}` };
    try {
      const hit = await env.DB.prepare("SELECT v FROM mt_cache WHERE k = ?").bind(key).first("v");
      if (hit) return new Response(hit, { headers: { ...headers, "content-type": "application/json", "x-cache": "hit" } });
    } catch {
      // cache table missing or busy: compute directly
    }

    let body;
    try {
      body = await insights(env.DB, url);
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
    if (body.error) return Response.json(body, { status: 400 });
    const json = JSON.stringify(body);
    ctx.waitUntil(
      env.DB.prepare("INSERT OR REPLACE INTO mt_cache (k, v, at) VALUES (?, ?, ?)")
        .bind(key, json, new Date().toISOString())
        .run()
        .catch(() => {}),
    );
    return new Response(json, { headers: { ...headers, "content-type": "application/json", "x-cache": "miss" } });
  },
};

export default worker;
