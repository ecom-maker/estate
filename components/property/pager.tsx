import Link from "next/link";

/** Compact page list for the pager: 1 … c-1 c c+1 … last, gaps as "…". */
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  const keep = new Set<number>([1, totalPages]);
  for (let n = current - 1; n <= current + 1; n++) {
    if (n >= 1 && n <= totalPages) keep.add(n);
  }
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

const btn =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-card px-3 text-sm font-medium text-primary transition hover:border-accent";
const active =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-accent bg-accent/10 px-3 text-sm font-medium text-accent";
const disabled =
  "inline-flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-full border border-border/60 bg-card px-3 text-sm font-medium text-muted/50";

/**
 * Numbered pager with a windowed range (first … around-current … last) plus
 * Prev/Next. `hrefFor(p)` builds the link for page `p` so callers keep their
 * own filters/sort in the query string. Renders nothing for a single page.
 */
export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex flex-wrap items-center justify-center gap-1.5"
    >
      {page > 1 ? (
        <Link rel="prev" href={hrefFor(page - 1)} className={btn}>
          Prev
        </Link>
      ) : (
        <span className={disabled}>Prev</span>
      )}
      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-sm text-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={p === page ? active : btn}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link rel="next" href={hrefFor(page + 1)} className={btn}>
          Next
        </Link>
      ) : (
        <span className={disabled}>Next</span>
      )}
    </nav>
  );
}
