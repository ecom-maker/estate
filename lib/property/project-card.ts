import { buildUnitGroups } from "@/lib/property/unit-groups";

export type ProjectBedConfig = {
  label: string; // "1 Bed", "Studio"
  fromLabel: string; // "from 3.0M AED"
  beds: number | null;
};

export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  developer: string | null;
  community: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  offPlan: boolean;
  handover: string | null; // "Oct 2027"
  startingPriceAed: number | null;
  beds: ProjectBedConfig[];
  bedsHeading: string; // "1, 2 & 3 Beds Available"
  bedRange: string | null; // "1 – 3 beds"
  bathRange: string | null; // "1 – 3 baths"
  sizeRange: string | null; // "650 – 1,850 sqft"
};

type UnitLike = {
  id: string;
  unitNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
};

type ProjectLike = {
  id: string;
  slug: string;
  title: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
  offPlan: boolean;
  metadata: unknown;
  developer: { name: string } | null;
  community: { name: string } | null;
  images: { url: string; alt: string | null }[];
  units: UnitLike[];
  floorplans: { url: string; title: string; unitRef: string | null }[];
};

const fmtSqft = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** "1, 2 & 3" from ["1","2","3"]. */
function joinAmp(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
}

function handoverLabel(metadata: unknown): string | null {
  const meta = (metadata ?? {}) as { handoverDate?: string };
  if (!meta.handoverDate) return null;
  const d = new Date(meta.handoverDate);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function toProjectCardData(p: ProjectLike): ProjectCardData {
  const groups = buildUnitGroups(p);
  const beds: ProjectBedConfig[] = groups.map((g) => ({
    label: g.label,
    fromLabel: g.fromLabel,
    beds: g.key === "other" ? null : Number(g.key),
  }));

  // Ranges from the actual units (fall back to the project's own specs).
  const units: UnitLike[] = p.units.length
    ? p.units
    : [
        {
          id: p.id,
          unitNumber: "Type A",
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          areaSqft: p.areaSqft,
          priceAed: p.priceAed,
        },
      ];

  const bedNums = [
    ...new Set(units.map((u) => u.bedrooms).filter((b): b is number => b != null)),
  ].sort((a, b) => a - b);
  const baths = units
    .map((u) => u.bathrooms)
    .filter((b): b is number => b != null);
  const areas = units
    .map((u) => u.areaSqft)
    .filter((a): a is number => a != null);

  const bedToken = (n: number) => (n === 0 ? "Studio" : String(n));
  const hasStudio = bedNums.includes(0);
  const nonZero = bedNums.filter((n) => n > 0);
  const headParts = [...(hasStudio ? ["Studio"] : []), ...nonZero.map(String)];
  const bedsHeading = headParts.length
    ? `${joinAmp(headParts)} ${nonZero.length > 1 || headParts.length > 1 ? "Beds" : "Bed"} Available`
    : "Units Available";

  const bedRange = bedNums.length
    ? bedNums.length === 1
      ? bedNums[0] === 0
        ? "Studio"
        : `${bedNums[0]} ${bedNums[0] === 1 ? "bed" : "beds"}`
      : `${bedToken(bedNums[0])} – ${bedNums[bedNums.length - 1]} beds`
    : null;

  const bathRange = baths.length
    ? (() => {
        const lo = Math.min(...baths);
        const hi = Math.max(...baths);
        return lo === hi
          ? `${lo} ${lo === 1 ? "bath" : "baths"}`
          : `${lo} – ${hi} baths`;
      })()
    : null;

  const sizeRange = areas.length
    ? (() => {
        const lo = Math.min(...areas);
        const hi = Math.max(...areas);
        return lo === hi ? `${fmtSqft(lo)} sqft` : `${fmtSqft(lo)} – ${fmtSqft(hi)} sqft`;
      })()
    : null;

  const img = p.images[0];

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    developer: p.developer?.name ?? null,
    community: p.community?.name ?? null,
    imageUrl: img?.url ?? null,
    imageAlt: img?.alt ?? p.title,
    offPlan: p.offPlan,
    handover: handoverLabel(p.metadata),
    startingPriceAed: p.priceAed,
    beds,
    bedsHeading,
    bedRange,
    bathRange,
    sizeRange,
  };
}

/** Prisma include needed to build a project card. */
export const projectCardInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  community: true,
  developer: true,
  units: true,
  floorplans: true,
};
