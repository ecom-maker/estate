"use client";

import { ProjectImage } from "@/components/property/project-image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { AIChat } from "@/components/ai/ai-chat";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import { cn, formatAED } from "@/lib/utils";
import { unitPath } from "@/lib/property/unit-url";
import { unitMatchesDeal } from "@/lib/property/deal";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

type Unit = {
  id: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  priceAed: number | null;
  view: string | null;
  status: string | null;
  unitType?: string | null;
  metadata?: { listing?: string; rentPriceAed?: number } | null;
};

type PropertyCard = {
  id: string;
  slug: string;
  title: string;
  type?: string | null;
  priceAed: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  offPlan?: boolean | null;
  score?: number;
  images?: Array<{ url: string; alt: string | null }>;
  community?: { name: string; emirate?: string | null } | null;
  units?: Unit[];
};

export function SearchExperience({ initialQuery }: { initialQuery: string }) {
  // null = no search has run yet (show the idle prompt); an array (even empty)
  // = the assistant ran a search, so the grid reflects exactly those matches.
  const [propertyIds, setPropertyIds] = useState<string[] | null>(null);
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (propertyIds === null) return; // no search yet
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      // Fetch matches in parallel and preserve the ranked order.
      const settled = await Promise.all(
        propertyIds.map(async (id) => {
          try {
            const res = await fetch(`/api/properties/${id}`);
            const json = await res.json();
            return json.success ? (json.data as PropertyCard) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setProperties(settled.filter((p): p is PropertyCard => p !== null));
        setLoadingResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyIds]);

  const isSearch = propertyIds !== null;
  const busy = searching || loadingResults;
  // Rent vs sale intent from the query, so a "for rent" search only shows
  // units actually offered for rent.
  const deal: "sale" | "rent" = /\b(rent|rental|lease|to\s?let)\b/i.test(
    initialQuery,
  )
    ? "rent"
    : "sale";
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 md:px-10">
      {showFilters ? (
        <div className="relative z-30 mb-8">
          <PropertyFilterBar showDeal />
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[1.1fr_minmax(320px,0.9fr)]">
      <aside className="flex h-[70vh] flex-col self-start rounded-sm border border-border bg-card p-4 md:order-2 md:sticky md:top-24">
        <AIChat
          placeholder="Ask a follow-up..."
          showHistory
          whatsappNumber={WHATSAPP_NUMBER}
          autoSendOnMount={initialQuery || undefined}
          initialMessages={
            initialQuery ? [{ role: "user", content: initialQuery }] : []
          }
          onPropertyIds={(ids) => setPropertyIds(ids)}
          onStreaming={setSearching}
        />
      </aside>

      <section className="md:order-1">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-primary">Results</h1>
            <p className="mt-1 text-sm text-muted">
              {busy
                ? "Searching inventory…"
                : isSearch
                  ? `${properties.length} matching · from your search`
                  : `${properties.length} properties · dual-view · map-ready`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Search
            </button>
            <Link
              href="/properties"
              className="text-sm font-medium text-accent hover:underline"
            >
              Browse all
            </Link>
          </div>
        </div>

        {busy ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            Finding the best matches for your request…
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            {isSearch
              ? "No matching properties for those filters. Ask the assistant to broaden your search."
              : "Start from the homepage chat bar or ask a question on the left."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Results are individual units from the matched projects (max 6
                per project), preserving the assistant's ranking. */}
            {properties
              .flatMap((p) => {
                const imgs = p.images ?? [];
                const base = {
                  projectSlug: p.slug,
                  projectTitle: p.title,
                  community: p.community?.name ?? "Dubai",
                  image: imgs[0] ?? null,
                  offPlan: p.offPlan ?? false,
                };
                // Only the units offered for this search's deal (sale/rent).
                const matched = (p.units ?? []).filter((u) =>
                  unitMatchesDeal(u.metadata, deal),
                );
                if (matched.length) {
                  // Cycle through the project's photos so consecutive units of
                  // the same project don't all show the same image.
                  return matched.slice(0, 6).map((u, i) => ({
                    key: `u-${u.id}`,
                    href: unitPath({
                      id: u.id,
                      bedrooms: u.bedrooms,
                      unitType: u.unitType,
                      property: {
                        slug: p.slug,
                        title: p.title,
                        type: p.type,
                        community: p.community,
                      },
                    }),
                    ...base,
                    image: imgs.length ? imgs[i % imgs.length] : null,
                    bedrooms: u.bedrooms,
                    bathrooms: u.bathrooms,
                    areaSqft: u.areaSqft,
                    priceAed:
                      deal === "rent"
                        ? (u.metadata?.rentPriceAed ?? null)
                        : u.priceAed,
                    view: u.view,
                    status: u.status,
                  }));
                }
                return [
                  {
                    key: `p-${p.id}`,
                    href: `/projects/${p.slug}`,
                    ...base,
                    bedrooms: p.bedrooms,
                    bathrooms: p.bathrooms,
                    areaSqft: p.areaSqft,
                    priceAed: p.priceAed,
                    view: null as string | null,
                    status: null as string | null,
                  },
                ];
              })
              .map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  className="group overflow-hidden rounded-sm border border-border bg-card transition hover:border-accent"
                >
                  <div className="relative aspect-[4/3] bg-primary/10">
                    <ProjectImage
                      url={c.image?.url ?? null}
                      alt={c.image?.alt ?? null}
                      title={c.projectTitle}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {c.community}
                    </p>
                    <h2 className="mt-1 truncate font-serif text-xl text-primary">
                      {c.projectTitle}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {c.bedrooms == null
                        ? "—"
                        : c.bedrooms === 0
                          ? "Studio"
                          : `${c.bedrooms} bed`}{" "}
                      · {c.bathrooms ?? "—"} bath ·{" "}
                      {c.areaSqft != null
                        ? Math.round(c.areaSqft).toLocaleString()
                        : "—"}{" "}
                      sqft
                      {c.view ? ` · ${c.view} view` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">
                        {formatAED(c.priceAed)}
                      </p>
                      {c.status ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide capitalize text-primary">
                          {c.status}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            c.offPlan
                              ? "bg-accent/15 text-accent"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {c.offPlan ? "Off-plan" : "Completed"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
