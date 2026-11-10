"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import {
  SAVED_EVENT,
  SAVED_KEY,
  readSaved,
  removeSaved,
  type SavedItem,
} from "@/lib/property/saved-store";

function savedDateLabel(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Newest-saved first; un-dated (legacy) entries fall to the end. */
function sortBySaved(items: SavedItem[]): SavedItem[] {
  return [...items].sort((a, b) => {
    const ta = a.savedAt ? Date.parse(a.savedAt) : 0;
    const tb = b.savedAt ? Date.parse(b.savedAt) : 0;
    return tb - ta;
  });
}

export function SavedPropertiesList() {
  // `null` until mounted, so the server/first paint doesn't assume empty.
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useEffect(() => {
    const sync = () => setItems(sortBySaved(readSaved()));
    sync();
    // Same-tab saves dispatch SAVED_EVENT; other tabs fire the storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SAVED_KEY) sync();
    };
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (items === null) {
    return <p className="text-sm text-muted">Loading your saved properties…</p>;
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <Heart className="mx-auto h-6 w-6 text-muted" aria-hidden />
        <p className="mt-3 text-sm text-muted">
          You haven&rsquo;t saved any properties yet.
        </p>
        <Link
          href="/properties"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Browse properties
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const date = savedDateLabel(item.savedAt);
        const body = (
          <div className="flex items-center gap-4">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt=""
                className="h-16 w-16 flex-none rounded-md object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-md bg-accent/10">
                <Heart className="h-5 w-5 text-accent" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg text-primary">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="mt-0.5 truncate text-sm text-muted">
                  {item.subtitle}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">
                {date ? `Saved ${date}` : "Saved"}
              </p>
            </div>
          </div>
        );

        return (
          <li
            key={item.id}
            className="group relative rounded-lg border border-border bg-card p-4 transition hover:border-accent"
          >
            {item.path ? (
              <Link href={item.path} className="block pr-8">
                {body}
              </Link>
            ) : (
              <div className="pr-8">{body}</div>
            )}
            <button
              type="button"
              onClick={() => removeSaved(item.id)}
              aria-label={`Remove ${item.title} from saved`}
              className="absolute right-3 top-3 rounded-full p-1 text-muted transition hover:bg-accent/10 hover:text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
