/**
 * Fills `property_units.unit_type` from what the data feed stored (see
 * lib/property/unit-type.ts for the rules). Only units with no type yet are
 * touched, so types set in Admin are kept; safe to re-run after every import.
 *
 * Also reports what the feed provides, so gaps can be fixed at the source or
 * in Admin:
 *   - which metadata keys unit rows carry
 *   - projects whose feed lists a type (e.g. Penthouse) that none of their
 *     units could be matched to
 *
 * Usage (DATABASE_URL in the environment):
 *   npx tsx scripts/backfill-unit-types.ts            dry run: lists what would change
 *   npx tsx scripts/backfill-unit-types.ts --write    writes to the DB
 */
import { PrismaClient, type PropertyType } from "@prisma/client";
import { inferUnitType, projectListsType } from "../lib/property/unit-type";

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

const SPECIAL: PropertyType[] = ["PENTHOUSE", "TOWNHOUSE", "VILLA"];

async function main() {
  const projects = await prisma.property.findMany({
    where: { deletedAt: null },
    select: {
      title: true,
      type: true,
      metadata: true,
      units: { select: { id: true, unitNumber: true, unitType: true, metadata: true } },
    },
  });

  const bySource: Record<string, number> = {};
  const metaKeys = new Map<string, number>();
  const unmatched: string[] = [];
  let units = 0;
  let filled = 0;

  for (const p of projects) {
    const found = new Set<PropertyType>();
    for (const u of p.units) {
      units++;
      if (u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata)) {
        for (const k of Object.keys(u.metadata)) metaKeys.set(k, (metaKeys.get(k) ?? 0) + 1);
      }
      if (u.unitType) {
        found.add(u.unitType);
        bySource.existing = (bySource.existing ?? 0) + 1;
        continue;
      }
      const inferred = inferUnitType(u, p);
      if (!inferred) {
        bySource.unknown = (bySource.unknown ?? 0) + 1;
        continue;
      }
      found.add(inferred.type);
      bySource[inferred.source] = (bySource[inferred.source] ?? 0) + 1;
      filled++;
      console.log(`${p.title} · ${u.unitNumber}: ${inferred.type} (from ${inferred.source})`);
      if (WRITE) {
        await prisma.propertyUnit.update({ where: { id: u.id }, data: { unitType: inferred.type } });
      }
    }
    for (const t of SPECIAL) {
      if (projectListsType(p.metadata, t) && !found.has(t) && p.units.length) {
        unmatched.push(`${p.title}: feed lists ${t.toLowerCase()} but no unit is marked as one`);
      }
    }
  }

  console.log("\nUnit metadata keys seen:", [...metaKeys].map(([k, n]) => `${k} (${n})`).join(", ") || "none");
  if (unmatched.length) {
    console.log("\nNeeds a look (set the unit type in Admin → Units, or add it to the feed):");
    for (const line of unmatched) console.log(`  - ${line}`);
  }
  console.log(
    `\n${units} units checked · ${Object.entries(bySource)
      .map(([k, n]) => `${k}: ${n}`)
      .join(" · ")}\n${filled} ${WRITE ? "updated" : "would be set (dry run; pass --write)"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
