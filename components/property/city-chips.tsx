"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export type CityChip = { label: string; href: string; active: boolean };

/**
 * A row of city filter chips (used on /projects). Renders nothing when there's
 * one or no chip. The list page is `force-dynamic`, so a tap takes a beat to
 * re-render — without feedback that feels unclickable on a phone. So each tap
 * navigates through a transition: the row fades while the new results load,
 * `touch-manipulation` drops the mobile tap delay, and chips get a press state.
 * Modifier / middle clicks keep the browser default (open in a new tab).
 */
export function CityChips({ chips }: { chips: CityChip[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (chips.length < 2) return null;

  return (
    <div
      className={cn(
        // Mobile: a single row that scrolls sideways (bleeds to the px-6 gutter
        // edges, scrollbar hidden). Desktop: wraps normally.
        "-mx-6 flex max-w-full flex-nowrap gap-2 overflow-x-auto px-6 transition-opacity [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0",
        pending && "opacity-60",
      )}
    >
      {chips.map((c) => (
        <a
          key={c.href}
          href={c.href}
          aria-pressed={c.active}
          onClick={(e) => {
            if (
              e.defaultPrevented ||
              e.metaKey ||
              e.ctrlKey ||
              e.shiftKey ||
              e.altKey ||
              e.button !== 0
            ) {
              return;
            }
            e.preventDefault();
            startTransition(() => router.push(c.href, { scroll: false }));
          }}
          className={cn(
            "shrink-0 touch-manipulation rounded-full border px-4 py-1.5 text-xs font-medium transition active:scale-95",
            c.active
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:border-accent hover:text-primary",
          )}
        >
          {c.label}
        </a>
      ))}
    </div>
  );
}
