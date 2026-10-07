/**
 * Stores nearby landmarks (straight-line km, from latitude/longitude) on every
 * live property, in `metadata_json.nearby`. Other metadata keys are kept.
 *
 * Recomputes from the current coordinates each run and writes only rows whose
 * result changed, so it is safe to re-run after every Reelly import. Properties
 * without coordinates, or outside Dubai, get the key removed.
 *
 * Usage (DATABASE_URL in the environment):
 *   npx tsx scripts/compute-nearby.ts            dry run: lists what would change
 *   npx tsx scripts/compute-nearby.ts --write    writes to the DB
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { computeNearby } from "../lib/property/nearby";

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.property.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, latitude: true, longitude: true, metadata: true },
  });

  let changed = 0;
  for (const p of rows) {
    const meta = (p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? p.metadata
      : {}) as Record<string, unknown>;
    const nearby = computeNearby(p.latitude, p.longitude);

    const next = { ...meta };
    if (nearby.length) next.nearby = nearby;
    else delete next.nearby;
    // Compare by value: Postgres jsonb reorders object keys, so raw JSON differs.
    const key = (v: unknown) =>
      Array.isArray(v) ? v.map((n) => `${n?.name}|${n?.km}`).join(";") : "";
    if (key(meta.nearby) === key(next.nearby)) continue;

    changed++;
    console.log(
      `${p.slug}: ${nearby.length ? nearby.map((n) => `${n.name} ${n.km}km`).join(", ") : "(none)"}`,
    );
    if (WRITE) {
      await prisma.property.update({
        where: { id: p.id },
        data: { metadata: next as Prisma.InputJsonValue },
      });
    }
  }

  console.log(
    `${rows.length} properties checked, ${changed} ${WRITE ? "updated" : "would change (dry run; pass --write)"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
