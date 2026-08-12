"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Waterfront villas under AED 30M",
  "Best investment properties in Dubai",
  "5-bedroom villas near top schools",
  "Off-plan properties with flexible payment plans",
];

export function HeroChatBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ q: trimmed });
    router.push(`/search?${params.toString()}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(query);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="w-full max-w-3xl"
    >
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
            placeholder="Tell me what you're looking for..."
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
            Search
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>

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
    </motion.div>
  );
}
