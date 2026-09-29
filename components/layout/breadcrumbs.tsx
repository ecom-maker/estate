import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/data-layer/canonical";

export type Crumb = { label: string; href?: string };

/** Accessible breadcrumb trail + schema.org BreadcrumbList for crawlers. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-y-1">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center">
              {i > 0 ? (
                <span className="mx-2" aria-hidden>
                  /
                </span>
              ) : null}
              {c.href && !isLast ? (
                <Link href={c.href} className="transition hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "text-primary" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd data={jsonLd} />
    </nav>
  );
}
