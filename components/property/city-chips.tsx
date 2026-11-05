import Link from "next/link";
import type { CityFacet } from "@/lib/property/city-facets";

/**
 * A row of city filter chips. Renders nothing when there's only one city, so
 * single-city catalogues are visually unchanged. `hrefFor` builds the link for
 * a city (or null for "All cities"); `selected` is the active city, if any.
 */
export function CityChips({
  facets,
  hrefFor,
  selected,
}: {
  facets: CityFacet[];
  /** Builds the link for a city name (or null for "All cities"). */
  hrefFor: (city: string | null) => string;
  selected: string | null;
}) {
  if (facets.length < 2) return null;

  const active = selected?.toLowerCase() ?? null;

  const chip = (label: string, href: string, isActive: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
        isActive
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {chip("All cities", hrefFor(null), active == null)}
      {facets.map((f) =>
        chip(
          `${f.city} (${f.count})`,
          hrefFor(f.city),
          active === f.city.toLowerCase(),
        ),
      )}
    </div>
  );
}
