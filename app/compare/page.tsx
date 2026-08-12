import { CompareTable } from "@/components/property/compare-table";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare" };

export default async function ComparePage() {
  let items: Array<{
    id: string;
    title: string;
    priceAed: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    rentalYield: number | null;
    community: string | null;
    developer: string | null;
  }> = [];

  try {
    const properties = await prisma.property.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      include: { community: true, developer: true },
      take: 8,
      orderBy: { priceAed: "desc" },
    });
    items = properties.map((p) => ({
      id: p.id,
      title: p.title,
      priceAed: p.priceAed,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      areaSqft: p.areaSqft,
      rentalYield: p.rentalYield,
      community: p.community?.name ?? null,
      developer: p.developer?.name ?? null,
    }));
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Compare
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">
        Property comparison
      </h1>
      <p className="mt-2 text-sm text-muted">
        Side-by-side facts only — AI summaries never invent missing metrics.
      </p>
      <div className="mt-10 rounded-sm border border-border bg-card p-6">
        {items.length ? (
          <CompareTable items={items} />
        ) : (
          <p className="text-sm text-muted">
            Seed the database to compare listings.
          </p>
        )}
      </div>
    </div>
  );
}
