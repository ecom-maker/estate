"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { AIChat } from "@/components/ai/ai-chat";
import { PropertyFilterBar } from "@/components/search/property-filter-bar";
import { ProjectCard } from "@/components/property/project-card";
import type { ProjectCardData } from "@/lib/property/project-card";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

export function ProjectBrowser({
  initialProjects,
  eyebrowLabel,
  heading,
  subheading,
  altLinkHref,
  altLinkLabel,
  chatPlaceholder,
}: {
  initialProjects: ProjectCardData[];
  eyebrowLabel?: string;
  heading: string;
  subheading: string;
  altLinkHref: string;
  altLinkLabel: string;
  chatPlaceholder: string;
}) {
  const [projects, setProjects] = useState<ProjectCardData[]>(initialProjects);
  const [ids, setIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (ids === null) return; // no search yet — keep the browse view
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      try {
        const res = await fetch(`/api/projects/cards?ids=${ids.join(",")}`);
        const json = await res.json();
        if (!cancelled) {
          setProjects(json.success ? (json.data as ProjectCardData[]) : []);
        }
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const isSearch = ids !== null;
  const busy = searching || loadingResults;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 md:px-10">
      {showFilters ? (
        <div className="relative z-30 mb-8">
          <PropertyFilterBar showDeal />
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[1.2fr_minmax(320px,0.8fr)]">
        <aside className="flex h-[70vh] flex-col self-start rounded-sm border border-border bg-card p-4 md:order-2 md:sticky md:top-24">
          <AIChat
            placeholder={chatPlaceholder}
            showHistory
            whatsappNumber={WHATSAPP_NUMBER}
            onPropertyIds={(next) => setIds(next)}
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
                    ? `${projects.length} matching · from your search`
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
          ) : projects.length === 0 ? (
            <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
              No matches. Ask the assistant to broaden your search.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {projects.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
