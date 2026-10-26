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

/**
 * Off-plan facet links (payment plans, handover-by-year) — only for facets that
 * have inventory, so the footer never links an empty page.
 */
const getFooterOffplan = unstable_cache(
  async (): Promise<{ hasPaymentPlan: boolean; handoverYears: number[] }> => {
    try {
      const rows = await prisma.property.findMany({
        where: { deletedAt: null, status: "ACTIVE", offPlan: true },
        select: { paymentPlan: true, metadata: true },
        take: 5000,
      });
      const hasPaymentPlan = rows.some((p) => {
        const pp = p.paymentPlan;
        return (
          typeof pp === "object" &&
          pp !== null &&
          Object.keys(pp as Record<string, unknown>).length > 0
        );
      });
      const now = new Date().getUTCFullYear();
      const years = new Set<number>();
      for (const p of rows) {
        const hd = (p.metadata as { handoverDate?: string } | null)
          ?.handoverDate;
        if (!hd) continue;
        const y = new Date(hd).getUTCFullYear();
        if (!Number.isNaN(y) && y >= now - 1 && y <= now + 10) years.add(y);
      }
      return {
        hasPaymentPlan,
        handoverYears: [...years].sort((a, b) => a - b),
      };
    } catch {
      return { hasPaymentPlan: false, handoverYears: [] };
    }
  },
  ["footer-explore-offplan"],
  { revalidate: 3600 },
);

export async function FooterExplore() {
  const [areas, offplan] = await Promise.all([
    getFooterAreas(),
    getFooterOffplan(),
  ]);
  if (!areas.length) return null;

  const offplanLinks = [
    ...(offplan.hasPaymentPlan
      ? [{ label: "Payment plan properties", href: "/payment-plan" }]
      : []),
    ...offplan.handoverYears.map((y) => ({
      label: `Handover ${y}`,
      href: `/handover/${y}`,
    })),
  ];

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
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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

        {offplanLinks.length ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Off-plan
            </h3>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {offplanLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted transition hover:text-primary"
                  >
                    {l.label}
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
