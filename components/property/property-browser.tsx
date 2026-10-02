"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SlidersHorizontal } from "lucide-react";
import { AIChat } from "@/components/ai/ai-chat";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import { cn, formatAED } from "@/lib/utils";

export type BrowserCard = {
  id: string;
  slug: string;
  title: string;
  priceAed: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  offPlan?: boolean | null;
  images?: { url: string; alt: string | null }[] | null;
  community?: { name: string } | null;
  developer?: { name: string } | null;
};

export function PropertyBrowser({
  initialProperties,
  cardBasePath,
  eyebrowField,
  showFromPrice,
  eyebrowLabel,
  heading,
  subheading,
  altLinkHref,
  altLinkLabel,
  chatPlaceholder,
}: {
  initialProperties: BrowserCard[];
  cardBasePath: string;
  eyebrowField: "community" | "developer";
  showFromPrice?: boolean;
  eyebrowLabel?: string;
  heading: string;
  subheading: string;
  altLinkHref: string;
  altLinkLabel: string;
  chatPlaceholder: string;
}) {
  const [properties, setProperties] = useState<BrowserCard[]>(initialProperties);
  const [propertyIds, setPropertyIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (propertyIds === null) return; // no search yet — keep the browse view
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      // Fetch matches in parallel and preserve the ranked order.
      const settled = await Promise.all(
        propertyIds.map(async (id) => {
          try {
            const res = await fetch(`/api/properties/${id}`);
            const json = await res.json();
            return json.success ? (json.data as BrowserCard) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setProperties(settled.filter((p): p is BrowserCard => p !== null));
        setLoadingResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyIds]);

  const isSearch = propertyIds !== null;
  const busy = searching || loadingResults;
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
          placeholder={chatPlaceholder}
          showHistory
          whatsappNumber={
            process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "971501234567"
          }
          onPropertyIds={(ids) => setPropertyIds(ids)}
          onStreaming={setSearching}
        />
      </aside>

      <section className="md:order-1">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            {eyebrowLabel ? (
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
                {eyebrowLabel}
              </p>
            ) : null}
            <h1 className="mt-1 font-serif text-3xl text-primary">{heading}</h1>
            <p className="mt-1 text-sm text-muted">
              {busy
                ? "Searching inventory…"
                : isSearch
                  ? `${properties.length} matching · from your search`
                  : subheading}
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
              href={altLinkHref}
              className="text-sm font-medium text-accent hover:underline"
            >
              {altLinkLabel}
            </Link>
          </div>
        </div>

        {busy ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            Finding the best matches for your request…
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            No matches. Ask the assistant to broaden your search.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {properties.map((property) => {
              const image = property.images?.[0];
              const eyebrow =
                eyebrowField === "developer"
                  ? (property.developer?.name ??
                    property.community?.name ??
                    "Dubai")
                  : (property.community?.name ?? "Dubai");
              return (
                <Link
                  key={property.id}
                  href={`${cardBasePath}/${property.slug}`}
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
                      {eyebrow}
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
                        {showFromPrice ? "from " : ""}
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
    </div>
  );
}
