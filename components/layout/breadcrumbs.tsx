import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/data-layer/canonical";

export type Crumb = { label: string; href?: string };

/**
 * Accessible breadcrumb trail + schema.org BreadcrumbList for crawlers.
 *
 * Every ListItem carries an `item` URL — Google rejects a BreadcrumbList when
 * any entry is missing it ("Missing field 'item' in itemListElement"). Crumbs
 * without their own href (the current page, or an unlinked level like the
 * developer name) fall back to `currentUrl`, the canonical URL of the page the
 * trail is rendered on.
 */
export function Breadcrumbs({
  items,
  currentUrl,
}: {
  items: Crumb[];
  currentUrl: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: c.href ? `${SITE_URL}${c.href}` : currentUrl,
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
