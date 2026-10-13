import type { Prisma, PropertyType } from "@prisma/client";
import type { SearchIntent } from "@/lib/validation/search-intent";

/**
 * Turns an AI search intent ("2 bed penthouse in Dubai Marina under 5M") into
 * a query over individual units for the /properties list.
 */

const TYPE: Record<string, PropertyType> = {
  villa: "VILLA",
  apartment: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
};

const text = (v: string) => ({ contains: v, mode: "insensitive" as const });

export function intentToUnitWhere(
  intent: SearchIntent,
  projectIds: string[] = [],
): Prisma.PropertyUnitWhereInput[] {
  const and: Prisma.PropertyUnitWhereInput[] = [];

  // Projects named in the query ("Lume Residences") take priority over areas.
  if (projectIds.length) {
    and.push({ propertyId: { in: projectIds } });
  } else {
    const place = intent.community ?? intent.location;
    if (place) {
      and.push({
        property: {
          OR: [
            { community: { name: text(place) } },
            { community: { city: text(place) } },
            { community: { emirate: text(place) } },
            { title: text(place) },
          ],
        },
      });
    }
  }
  if (intent.developer) and.push({ property: { developer: { name: text(intent.developer) } } });

  const types = (intent.propertyTypes?.length ? intent.propertyTypes : intent.propertyType ? [intent.propertyType] : [])
    .map((t) => TYPE[t])
    .filter(Boolean);
  if (types.length) {
    // The unit's own type when known, otherwise the project's.
    and.push({
      OR: [{ unitType: { in: types } }, { unitType: null, property: { type: { in: types } } }],
    });
  }

  // Units have one bedroom count, so "2 bed" means exactly 2.
  const beds = intent.bedroomsList?.length ? intent.bedroomsList : intent.bedrooms != null ? [intent.bedrooms] : [];
  if (beds.length) and.push({ bedrooms: { in: beds } });
  const baths = intent.bathroomsList?.length
    ? intent.bathroomsList
    : intent.bathrooms != null
      ? [intent.bathrooms]
      : [];
  if (baths.length) and.push({ bathrooms: { in: baths } });

  if (intent.minPriceAED) and.push({ priceAed: { gte: intent.minPriceAED } });
  if (intent.maxPriceAED) and.push({ priceAed: { lte: intent.maxPriceAED } });
  if (intent.minAreaSqft) and.push({ areaSqft: { gte: intent.minAreaSqft } });
  if (intent.maxAreaSqft) and.push({ areaSqft: { lte: intent.maxAreaSqft } });

  if (intent.offPlan === true) and.push({ property: { offPlan: true } });
  else if (intent.ready === true || intent.offPlan === false) and.push({ property: { offPlan: false } });
  if (intent.waterfront) and.push({ property: { waterfront: true } });
  if (intent.privateBeach) and.push({ property: { privateBeach: true } });
  if (intent.furnished) and.push({ property: { furnished: true } });
  return and;
}

const aedShort = (n: number) =>
  n >= 1_000_000 ? `AED ${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `AED ${Math.round(n / 1_000)}K` : `AED ${n}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the query was understood as, for chips under the search box. */
export function describeIntent(intent: SearchIntent, projectTitles: string[] = []): string[] {
  const out: string[] = [...projectTitles];
  if (!projectTitles.length && (intent.community ?? intent.location)) out.push((intent.community ?? intent.location)!);
  if (intent.developer) out.push(intent.developer);
  const types = intent.propertyTypes?.length ? intent.propertyTypes : intent.propertyType ? [intent.propertyType] : [];
  for (const t of types) out.push(cap(t));
  const beds = intent.bedroomsList?.length ? intent.bedroomsList : intent.bedrooms != null ? [intent.bedrooms] : [];
  if (beds.length) out.push(beds.map((b) => (b === 0 ? "Studio" : `${b} Bed`)).join(" / "));
  const baths = intent.bathroomsList?.length ? intent.bathroomsList : intent.bathrooms != null ? [intent.bathrooms] : [];
  if (baths.length) out.push(`${baths.join(" / ")} Bath`);
  if (intent.minPriceAED && intent.maxPriceAED) out.push(`${aedShort(intent.minPriceAED)} – ${aedShort(intent.maxPriceAED)}`);
  else if (intent.maxPriceAED) out.push(`Under ${aedShort(intent.maxPriceAED)}`);
  else if (intent.minPriceAED) out.push(`Over ${aedShort(intent.minPriceAED)}`);
  if (intent.minAreaSqft) out.push(`${intent.minAreaSqft.toLocaleString("en-US")}+ sqft`);
  if (intent.maxAreaSqft) out.push(`Up to ${intent.maxAreaSqft.toLocaleString("en-US")} sqft`);
  if (intent.offPlan === true) out.push("Off-plan");
  else if (intent.ready === true || intent.offPlan === false) out.push("Ready");
  if (intent.waterfront) out.push("Waterfront");
  if (intent.privateBeach) out.push("Private beach");
  if (intent.furnished) out.push("Furnished");
  return out;
}

/** Project titles mentioned in the query, e.g. "2 bed in lume residences". */
export function mentionedProjects<T extends { title: string }>(query: string, projects: T[]): T[] {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return projects.filter((p) => {
    const t = p.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return t.length >= 4 && q.includes(` ${t} `);
  });
}
