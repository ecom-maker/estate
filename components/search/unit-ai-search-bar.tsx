"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useRequireAuth } from "@/components/auth/sign-in-gate";

/**
 * AI query box for the /properties unit list (same look as the home page's
 * "Ask AI" box). The query is turned into filters on the server and the list
 * below updates; `understood` shows what it was read as.
 */
export function UnitAiSearchBar({
  initialQuery = "",
  understood = [],
}: {
  initialQuery?: string;
  understood?: string[];
}) {
  const router = useRouter();
  // AI queries need a signed-in visitor (agents and automation skip this).
  const requireAuth = useRequireAuth();
  const [query, setQuery] = useState(initialQuery);

  function submit(value: string) {
    const q = value.trim();
    const url = q ? `/properties?${new URLSearchParams({ q }).toString()}` : "/properties";
    if (!q) {
      router.push(url);
      return;
    }
    void requireAuth(() => router.push(url), {
      next: url,
      title: "Sign in to ask our AI",
      message: "It takes one tap with Google. Your search runs as soon as you’re signed in.",
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(query);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative overflow-hidden rounded-sm border border-border bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur"
    >
      <label htmlFor="units-ai-search" className="sr-only">
        Tell me what you are looking for
      </label>
      <div className="flex items-start gap-3 px-5 pt-5">
        <Sparkles className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <textarea
          id="units-ai-search"
          rows={2}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(query);
            }
          }}
          placeholder="Tell me what you're looking for..."
          className="w-full resize-none bg-transparent text-base leading-relaxed text-primary placeholder:text-muted outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-3">
        {understood.length ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">Showing:</span>
            {understood.map((u) => (
              <span key={u} className="rounded-full bg-accent/10 px-2.5 py-0.5 font-medium text-accent">
                {u}
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                router.push("/properties");
              }}
              className="ml-1 font-medium text-muted underline-offset-2 transition hover:text-primary hover:underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="hidden text-xs text-muted sm:block">
            Conversational search · structured filters · never invents facts
          </p>
        )}
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Search
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
