import Link from "next/link";
import { formatAED } from "@/lib/utils";
import { ProjectImage } from "@/components/property/project-image";
import type { ProjectCardData } from "@/lib/property/project-card";

export function ProjectCard({ p }: { p: ProjectCardData }) {
  return (
    <Link
      href={`/projects/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition hover:border-accent hover:shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
    >
      {/* Image + badges */}
      <div className="relative aspect-[16/11] bg-primary/10">
        <ProjectImage url={p.imageUrl} alt={p.imageAlt} title={p.title} />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {p.offPlan ? (
            <span className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm">
              Off-plan
            </span>
          ) : null}
          {p.handover ? (
            <span className="rounded-md bg-primary/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
              Handover {p.handover}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        {p.developer ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            {p.developer}
          </p>
        ) : null}
        <h3 className="mt-1 font-serif text-2xl leading-tight text-primary">
          {p.title}
        </h3>
        {p.community ? (
          <p className="mt-1 text-sm text-muted">{p.community}</p>
        ) : null}

        {/* Beds available box */}
        {p.beds.length ? (
          <div className="mt-4 rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {p.bedsHeading}
              </span>
              {p.sizeRange ? (
                <span className="shrink-0 text-xs text-muted">{p.sizeRange}</span>
              ) : null}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {p.beds.map((b) => (
                <span
                  key={b.label}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold text-accent">{b.label}</span>
                  {b.fromLabel ? (
                    <span className="text-muted">{b.fromLabel}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Summary line */}
        <p className="mt-3 text-xs text-muted">
          {[p.bedRange, p.bathRange, p.sizeRange ? `${p.sizeRange}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Footer */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Starting from
            </p>
            <p className="mt-0.5 font-serif text-xl text-primary">
              {p.startingPriceAed != null ? formatAED(p.startingPriceAed) : "—"}
            </p>
          </div>
          <span className="rounded-md border border-border px-4 py-2 text-sm font-medium text-primary transition group-hover:border-accent group-hover:text-accent">
            View units
          </span>
        </div>
      </div>
    </Link>
  );
}
