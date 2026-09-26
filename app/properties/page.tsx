import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { cn, formatAED } from "@/lib/utils";
import { AIChat } from "@/components/ai/ai-chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties" };

type PropertyCard = Prisma.PropertyGetPayload<{
  include: { images: true; community: true };
}>;

export default async function PropertiesPage() {
  let properties: PropertyCard[] = [];
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
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-28 md:grid-cols-[minmax(320px,0.9fr)_1.1fr] md:px-10">
      <aside className="flex h-[70vh] flex-col self-start rounded-sm border border-border bg-card p-4 md:sticky md:top-24 md:h-[calc(100vh-7rem)]">
        <AIChat placeholder="Ask about our properties..." />
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-primary">Properties</h1>
            <p className="mt-1 text-sm text-muted">
              {properties.length} listings · luxury villas, residences &
              investments
            </p>
          </div>
          <Link
            href="/search"
            className="text-sm font-medium text-accent hover:underline"
          >
            AI search
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            No properties yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {properties.map((property) => {
              const image = property.images[0];
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
                        sizes="(max-width:768px) 100vw, 40vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {property.community?.name ?? "Dubai"}
                    </p>
                    <h2 className="mt-1 font-serif text-xl text-primary">
                      {property.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {property.bedrooms ?? "—"} bed ·{" "}
                      {property.bathrooms ?? "—"} bath ·{" "}
                      {property.areaSqft?.toLocaleString() ?? "—"} sqft
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">
                        {formatAED(property.priceAed)}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          property.offPlan
                            ? "bg-accent/15 text-accent"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {property.offPlan ? "Off-plan" : "Completed"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
