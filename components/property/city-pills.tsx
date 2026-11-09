"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export type CityPill = {
  city: string;
  count: number;
  href: string;
  active: boolean;
};

/**
 * City breakdown pills for the /properties header. They filter the unit list by
 * city. The list page is `force-dynamic`, so a tap takes a beat to re-render on
 * the server — without feedback that feels unclickable, especially on a phone.
 * So each tap: navigates through a transition, shows the tapped pill as pending
 * and fades the whole row, and uses `touch-manipulation` to drop the mobile
 * tap-delay. The row scrolls sideways on mobile and wraps from md up.
 */
export function CityPills({ pills }: { pills: CityPill[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "-mx-6 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto px-6 transition-opacity [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0",
        pending && "opacity-60",
      )}
    >
      {pills.map((p) => (
        <a
          key={p.city}
          href={p.href}
          aria-pressed={p.active}
          onClick={(e) => {
            // Left-click without a modifier → in-app navigation with a visible
            // pending state. Modifier / middle clicks keep the browser default
            // (open in a new tab).
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
            startTransition(() => router.push(p.href, { scroll: false }));
          }}
          className={cn(
            "inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition active:scale-95",
            p.active
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-card text-primary hover:border-accent",
          )}
        >
          {p.city}
          <span className={p.active ? "text-accent/70" : "text-muted"}>
            {p.count.toLocaleString()}
          </span>
        </a>
      ))}
    </div>
  );
}
