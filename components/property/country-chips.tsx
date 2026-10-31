import Link from "next/link";
import type { CountryFacet } from "@/lib/property/country-facets";

/**
 * A row of country filter chips. Renders nothing when there's only one country,
 * so single-country catalogues are visually unchanged. `basePath` is the page
 * the chips link to; `selected` is the active ISO-2 code (or null for "All").
 */
export function CountryChips({
  facets,
  hrefFor,
  selected,
}: {
  facets: CountryFacet[];
  /** Builds the link for a country code (or null for "All countries"). */
  hrefFor: (code: string | null) => string;
  selected: string | null;
}) {
  if (facets.length < 2) return null;

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {chip("All countries", hrefFor(null), selected == null)}
      {facets.map((f) =>
        chip(
          `${f.name ?? f.code} (${f.count})`,
          hrefFor(f.code),
          selected === f.code,
        ),
      )}
    </div>
  );
}
