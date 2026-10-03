import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?error=AccessDenied");

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      property: {
        include: {
          community: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });

  return (
    <AgentShell
      title="Favorites"
      subtitle={`${favorites.length} saved ${favorites.length === 1 ? "property" : "properties"}.`}
    >
      {favorites.length === 0 ? (
        <EmptyState>
          No favorites yet. Open a property and tap the heart to save it here.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map(({ property: p }) => {
            const img = p.images[0];
            return (
              <Link
                key={p.id}
                href={`/properties/${p.slug}`}
                className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
              >
                <div className="relative aspect-[4/3] bg-primary/10">
                  {img?.url ? (
                    <Image
                      src={img.url}
                      alt={img.alt ?? p.title}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted">
                    {p.community?.name ?? "Dubai"}
                  </p>
                  <h2 className="mt-1 font-serif text-lg text-primary">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {p.bedrooms ?? "—"} bed · {p.bathrooms ?? "—"} bath ·{" "}
                    {p.areaSqft?.toLocaleString() ?? "—"} sqft
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {formatAED(p.priceAed)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AgentShell>
  );
}
