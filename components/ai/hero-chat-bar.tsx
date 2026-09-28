"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Waterfront villas under AED 30M",
  "Best investment properties in Dubai",
  "5-bedroom villas near top schools",
  "Off-plan properties with flexible payment plans",
];

type Mode = "rent" | "buy" | "sell" | "projects";

const MODES: { id: Mode; label: string }[] = [
  { id: "rent", label: "Rent" },
  { id: "buy", label: "Buy" },
  { id: "sell", label: "Sell" },
  { id: "projects", label: "New projects" },
];

const PLACEHOLDERS: Record<Mode, string> = {
  rent: "Describe the home you'd like to rent...",
  buy: "Tell me what you're looking for...",
  sell: "List your property with us — head to the agent portal.",
  projects: "Ask about new off-plan projects...",
};

export function HeroChatBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("buy");

  function submit(value: string) {
    // Sell and New projects are destinations, not searches.
    if (mode === "sell") {
      router.push("/agent");
      return;
    }
    if (mode === "projects") {
      router.push("/projects");
      return;
    }
    const base = value.trim() || "properties";
    // Bias the query so intent extraction picks up the deal type.
    const q = mode === "rent" ? `${base} for rent` : `${base} for sale`;
    router.push(`/search?${new URLSearchParams({ q }).toString()}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(query);
  }

  const isSearchMode = mode === "rent" || mode === "buy";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="w-full max-w-3xl"
    >
      {/* Deal-type segmented control */}
      <div
        role="tablist"
        aria-label="What would you like to do?"
        className="mb-4 inline-flex flex-wrap gap-1 rounded-full border border-white/15 bg-white/95 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.25)] backdrop-blur"
      >
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(item.id)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-primary/70 hover:text-primary",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className="relative overflow-hidden rounded-sm border border-white/15 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.35)] backdrop-blur"
      >
        <label htmlFor="hero-ai-search" className="sr-only">
          Tell me what you are looking for
        </label>
        <div className="flex items-start gap-3 px-5 pt-5">
          <Sparkles className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <textarea
            id="hero-ai-search"
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
            className="w-full resize-none bg-transparent text-base leading-relaxed text-primary placeholder:text-muted outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-3">
          <p className="hidden text-xs text-muted sm:block">
            Conversational search · structured filters · never invents facts
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {mode === "sell"
              ? "List property"
              : mode === "projects"
                ? "Browse projects"
                : "Search"}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>

      {isSearchMode ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion, index) => (
            <motion.button
              key={suggestion}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.06 }}
              onClick={() => submit(suggestion)}
              className="rounded-sm border border-white/25 bg-white/10 px-3 py-1.5 text-left text-xs text-white/90 backdrop-blur transition hover:border-accent hover:text-accent"
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
