/**
 * Pre-fills the dld-transactions Worker's answer cache (D1 table `mt_cache`)
 * for every live property and unit bedroom count, one question at a time, so
 * visitors and crawlers never trigger the heavy aggregation over 8M rows.
 *
 * Asks exactly what the pages ask (dldInsightsQuery), so the cache keys match.
 * Already-cached answers come back in milliseconds; new ones are computed with
 * a pause between them so D1 is never overloaded. Safe to re-run, e.g. after
 * new projects are imported or after the cache is cleared for a data top-up.
 *
 * Usage (DATABASE_URL in the environment; the Worker URL and secret come from
 * the `dld_worker` settings row, or DLD_WORKER_URL / DLD_WORKER_SECRET):
 *   npx tsx scripts/warm-dld-cache.ts
 */
import { PrismaClient } from "@prisma/client";
import { dldInsightsQuery } from "../lib/property/dld-communities";

const prisma = new PrismaClient();
const PAUSE_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function workerConfig(): Promise<{ url: string; secret: string }> {
  if (process.env.DLD_WORKER_URL && process.env.DLD_WORKER_SECRET) {
    return { url: process.env.DLD_WORKER_URL, secret: process.env.DLD_WORKER_SECRET };
  }
  const row = await prisma.setting.findFirst({ where: { key: "dld_worker", companyId: null } });
  const v = row?.value as { url?: string; secret?: string } | null;
  if (!v?.url || !v?.secret) throw new Error("No dld_worker settings row and no DLD_WORKER_URL/SECRET");
  return { url: v.url, secret: v.secret };
}

async function main() {
  const worker = await workerConfig();
  const props = await prisma.property.findMany({
    where: { deletedAt: null, status: { in: ["ACTIVE", "RESERVED"] } },
    select: {
      title: true,
      bedrooms: true,
      community: { select: { name: true } },
      units: { where: { hidden: false }, select: { bedrooms: true } },
    },
  });

  // Project pages ask with the project's bedrooms; unit pages with each unit's.
  const queries = new Set<string>();
  for (const p of props) {
    const beds = new Set<number | null>([p.bedrooms, ...p.units.map((u) => u.bedrooms)]);
    for (const b of beds) {
      const q = dldInsightsQuery({ bedrooms: b, community: p.community, building: p.title });
      if (q) queries.add(q);
    }
  }
  console.log(`${props.length} live properties -> ${queries.size} distinct questions`);

  let hits = 0, computed = 0, failed = 0;
  for (const q of queries) {
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const res = await fetch(`${worker.url}/insights?${q}`, { headers: { "x-dld-secret": worker.secret } });
      if (res.ok) {
        done = true;
        if (res.headers.get("x-cache") === "hit") hits++;
        else {
          computed++;
          await sleep(PAUSE_MS);
        }
      } else {
        await sleep(10_000 * (attempt + 1)); // D1 asks for a 10 s window to pass
      }
    }
    if (!done) {
      failed++;
      console.log("FAILED", q.slice(0, 160));
    }
  }
  console.log(`cached already: ${hits}, computed now: ${computed}, failed: ${failed}`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
