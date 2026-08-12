import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Properties" };

export default async function PropertiesPage() {
  let properties: Awaited<
    ReturnType<typeof prisma.property.findMany>
  > = [];

  try {
    properties = await prisma.property.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        community: true,
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
  } catch {
    properties = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Inventory
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Properties</h1>
      <p className="mt-2 text-sm text-muted">
        Luxury villas, residences, and investment homes.
      </p>

      {properties.length === 0 ? (
        <div className="mt-12 rounded-sm border border-border bg-card p-8 text-sm text-muted">
          No properties yet. Start Postgres via Docker, run migrations, then{" "}
          <code className="text-primary">npm run db:seed</code>.
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const image =
              "images" in property
                ? (property.images as { url: string; alt: string | null }[])[0]
                : undefined;
            const community =
              "community" in property
                ? (property.community as { name: string } | null)
                : null;
            return (
              <Link
                key={property.id}
                href={`/properties/${property.slug}`}
                className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
              >
                <div className="relative aspect-[4/3] bg-primary/10">
                  {image?.url ? (
                    <Image
                      src={image.url}
                      alt={image.alt ?? property.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width:768px) 100vw, 33vw"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted">
                    {community?.name ?? "Dubai"}
                  </p>
                  <h2 className="mt-1 font-serif text-xl text-primary">
                    {property.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {property.bedrooms ?? "—"} bed · {property.bathrooms ?? "—"}{" "}
                    bath · {property.areaSqft?.toLocaleString() ?? "—"} sqft
                  </p>
                  <p className="mt-3 text-sm font-medium text-primary">
                    {formatAED(property.priceAed)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
