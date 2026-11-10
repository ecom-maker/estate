/**
 * The visitor's saved properties, kept in localStorage so saving works without
 * an account and stays on the device. Historically this was a bare array of
 * share ids (`string[]`); it now stores a record per item with the metadata
 * needed to render the Saved Properties page — including when it was saved.
 * Legacy string entries are still read (and self-heal to full records when the
 * item's page is next opened, via `backfillSavedMeta`).
 *
 * All reads/writes are client-only (guarded by try/catch for private mode or
 * blocked storage). A write dispatches `dmg:saved-changed` so open views in the
 * same tab update immediately (the native `storage` event only fires in OTHER
 * tabs).
 */

export const SAVED_KEY = "dmg:saved";
export const SAVED_EVENT = "dmg:saved-changed";

export type SavedItem = {
  /** Stable share id (project slug, or unit canonical slug). */
  id: string;
  /** Canonical path to the item, e.g. "/projects/x" or "/properties/unit/y". */
  path: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  /** ISO timestamp the item was saved; "" for un-dated legacy entries. */
  savedAt: string;
};

function normalize(raw: unknown): SavedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedItem[] = [];
  for (const el of raw) {
    if (typeof el === "string") {
      // Legacy bare-id entry: keep it, with no path/date until it self-heals.
      out.push({ id: el, path: "", title: el, savedAt: "" });
    } else if (el && typeof el === "object") {
      const r = el as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      out.push({
        id: r.id,
        path: typeof r.path === "string" ? r.path : "",
        title: typeof r.title === "string" ? r.title : r.id,
        subtitle: typeof r.subtitle === "string" ? r.subtitle : undefined,
        image: typeof r.image === "string" ? r.image : null,
        savedAt: typeof r.savedAt === "string" ? r.savedAt : "",
      });
    }
  }
  return out;
}

export function readSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return normalize(raw ? (JSON.parse(raw) as unknown) : []);
  } catch {
    return [];
  }
}

function writeSaved(items: SavedItem[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(SAVED_EVENT));
  } catch {
    /* private mode / blocked storage — ignore */
  }
}

export function isSaved(id: string): boolean {
  return readSaved().some((i) => i.id === id);
}

export type SavedInput = Omit<SavedItem, "savedAt">;

/** Add an item (newest first). No-op if already saved (its date is kept). */
export function saveItem(item: SavedInput) {
  const items = readSaved();
  if (items.some((i) => i.id === item.id)) {
    backfillSavedMeta(item);
    return;
  }
  writeSaved([{ ...item, savedAt: new Date().toISOString() }, ...items]);
}

export function removeSaved(id: string) {
  writeSaved(readSaved().filter((i) => i.id !== id));
}

/**
 * Fill in missing metadata (path/title/date) on an already-saved entry without
 * changing its saved order. Lets legacy bare-id entries become linkable once
 * their page is opened again. Writes only when something is actually missing.
 */
export function backfillSavedMeta(item: SavedInput) {
  const items = readSaved();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) return;
  const ex = items[idx];
  const needsFix = !ex.path || !ex.savedAt || ex.title === ex.id;
  if (!needsFix) return;
  items[idx] = {
    ...ex,
    path: ex.path || item.path,
    title: ex.title && ex.title !== ex.id ? ex.title : item.title,
    subtitle: ex.subtitle ?? item.subtitle,
    image: ex.image ?? item.image ?? null,
    savedAt: ex.savedAt || new Date().toISOString(),
  };
  writeSaved(items);
}
