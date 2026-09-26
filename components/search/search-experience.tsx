"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AIChat } from "@/components/ai/ai-chat";
import { cn, formatAED } from "@/lib/utils";
import { decodeBase64UrlJson } from "@/lib/encoding";
import type { SearchIntent } from "@/lib/validation/search-intent";

type PropertyCard = {
  id: string;
  slug: string;
  title: string;
  priceAed: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  offPlan?: boolean | null;
  score?: number;
  images?: Array<{ url: string; alt: string | null }>;
  community?: { name: string } | null;
};

function decodeIntent(header: string | null): SearchIntent | null {
  if (!header) return null;
  return decodeBase64UrlJson<SearchIntent>(header);
}

export function SearchExperience({ initialQuery }: { initialQuery: string }) {
  const [intent, setIntent] = useState<SearchIntent | null>(
    initialQuery ? { queryText: initialQuery } : null,
  );
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(false);

  const queryString = useMemo(() => {
    if (!intent) return "";
    const params = new URLSearchParams();
    if (intent.propertyType) params.set("type", intent.propertyType);
    if (intent.community || intent.location) {
      params.set("community", intent.community ?? intent.location ?? "");
    }
    return params.toString();
  }, [intent]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (propertyIds.length) {
          const results: PropertyCard[] = [];
          for (const id of propertyIds) {
            const res = await fetch(`/api/properties/${id}`);
            const json = await res.json();
            if (json.success) results.push(json.data);
          }
          if (!cancelled) setProperties(results);
          return;
        }

        const res = await fetch(
          `/api/properties${queryString ? `?${queryString}` : ""}`,
        );
        const json = await res.json();
        if (!cancelled && json.success) {
          setProperties(json.data.items ?? []);
        }
      } catch {
        if (!cancelled) setProperties([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyIds, queryString]);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-28 md:grid-cols-[minmax(320px,0.9fr)_1.1fr] md:px-10">
      <aside className="flex h-[70vh] flex-col self-start rounded-sm border border-border bg-card p-4 md:sticky md:top-24 md:h-[calc(100vh-7rem)]">
        <AIChat
          placeholder="Ask a follow-up..."
          autoSendOnMount={initialQuery || undefined}
          initialMessages={
            initialQuery ? [{ role: "user", content: initialQuery }] : []
          }
          onIntent={(header) => setIntent(decodeIntent(header))}
          onPropertyIds={(ids) => setPropertyIds(ids)}
        />
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-primary">Results</h1>
            <p className="mt-1 text-sm text-muted">
              {loading
                ? "Updating matches…"
                : `${properties.length} properties · dual-view · map-ready`}
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-medium text-accent hover:underline"
          >
            Browse all
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
            {initialQuery
              ? "Ask the assistant to run or refine your search. Matching cards will appear here."
              : "Start from the homepage chat bar or ask a question on the left."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {properties.map((property) => {
              const image = property.images?.[0];
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
                        sizes="(max-width:768px) 100vw, 40vw"
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
