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
        "flex flex-wrap gap-2 transition-opacity",
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
            "touch-manipulation rounded-full border px-4 py-1.5 text-xs font-medium transition active:scale-95",
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
