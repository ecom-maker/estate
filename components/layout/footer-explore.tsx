import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { buildListingSlug, typeDefForType } from "@/lib/seo/listing-slug";

type Area = { name: string; slug: string; topType: string | null };

/**
 * Top communities by active-inventory count, with each one's most common
 * property type. Cached for an hour so the global footer runs one query, not
 * one per page. Returns [] on any error so the footer never breaks.
 */
const getFooterAreas = unstable_cache(
  async (): Promise<Area[]> => {
    try {
      const rows = await prisma.property.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          community: { isNot: null },
        },
        select: { type: true, community: { select: { name: true, slug: true } } },
        take: 5000,
      });

      const byCommunity = new Map<
        string,
        { name: string; count: number; types: Map<string, number> }
      >();
      for (const r of rows) {
        const c = r.community;
        if (!c?.slug) continue;
        const entry =
          byCommunity.get(c.slug) ??
          { name: c.name, count: 0, types: new Map<string, number>() };
        entry.count += 1;
        if (r.type) entry.types.set(r.type, (entry.types.get(r.type) ?? 0) + 1);
        byCommunity.set(c.slug, entry);
      }

      return [...byCommunity.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([slug, e]) => {
          const topType =
            [...e.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          return { name: e.name, slug, topType };
        });
    } catch {
      return [];
    }
  },
  ["footer-explore-areas"],
  { revalidate: 3600 },
);

export async function FooterExplore() {
  const areas = await getFooterAreas();
  if (!areas.length) return null;

  // "Popular searches": each top area's dominant property type.
  const searches = areas
    .filter((a) => a.topType)
    .slice(0, 6)
    .map((a) => {
      const def = typeDefForType(a.topType);
      return {
        label: `${def.label} in ${a.name}`,
        href: `/${buildListingSlug(def.token, "sale", a.slug)}`,
      };
    });

  return (
    <div className="mx-auto max-w-7xl border-b border-border px-6 py-10 md:px-10">
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            Popular areas
          </h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/${buildListingSlug("properties", "sale", a.slug)}`}
                  className="text-muted transition hover:text-primary"
                >
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {searches.length ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Popular searches
            </h3>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {searches.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="text-muted transition hover:text-primary"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
