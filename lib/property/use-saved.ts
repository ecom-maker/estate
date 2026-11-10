"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  SAVED_EVENT,
  SAVED_KEY,
  clearSaved,
  readSaved,
  removeSaved as removeLocal,
  saveItem as saveLocal,
  type SavedInput,
} from "./saved-store";

/**
 * One hook behind every Save heart and the Saved Properties page.
 *
 * - Signed in: the account is the source of truth (DB, cross-device). On first
 *   load any localStorage saves are migrated into the account, then cleared.
 * - Signed out — or if the account layer is unavailable (e.g. before the
 *   saved_listings migration is applied): falls back to the localStorage store,
 *   so saving keeps working and nothing is lost.
 */

const ACCOUNT_EVENT = "dmg:saved-account-changed";

export type SavedEntry = {
  ref: string;
  path: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  savedAt: string;
};

function fromLocal(): SavedEntry[] {
  return readSaved().map((i) => ({
    ref: i.id,
    path: i.path,
    title: i.title,
    subtitle: i.subtitle,
    image: i.image ?? null,
    savedAt: i.savedAt,
  }));
}

function kindOf(path: string): "property" | "project" {
  return path.startsWith("/projects/") ? "project" : "property";
}

type AccountRow = {
  ref: string;
  path: string;
  title: string;
  subtitle?: string | null;
  image?: string | null;
  createdAt?: string;
};

function rowToEntry(r: AccountRow): SavedEntry {
  return {
    ref: r.ref,
    path: r.path,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    image: r.image ?? null,
    savedAt: r.createdAt ?? "",
  };
}

/** Returns the account list, or null when the account layer isn't usable. */
async function accountList(): Promise<SavedEntry[] | null> {
  try {
    const res = await fetch("/api/saved", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    return (json.data.items as AccountRow[]).map(rowToEntry);
  } catch {
    return null;
  }
}

async function accountSave(item: SavedInput) {
  await fetch("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ref: item.id,
      kind: kindOf(item.path),
      path: item.path,
      title: item.title,
      subtitle: item.subtitle,
      image: item.image ?? null,
    }),
  });
}

async function accountRemove(ref: string) {
  await fetch("/api/saved", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref }),
  });
}

export function useSaved() {
  const { status } = useSession();
  const [entries, setEntries] = useState<SavedEntry[] | null>(null);
  // Stable flag the event listeners and toggle/remove read to pick account vs
  // local, without re-subscribing each render.
  const accountMode = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    let alive = true;

    const syncLocal = () => {
      if (alive && !accountMode.current) setEntries(fromLocal());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SAVED_KEY) syncLocal();
    };
    const onAccount = () => {
      if (!alive || !accountMode.current) return;
      void accountList().then((l) => {
        if (alive && l) setEntries(l);
      });
    };
    window.addEventListener(SAVED_EVENT, syncLocal);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ACCOUNT_EVENT, onAccount);

    void (async () => {
      if (status !== "authenticated") {
        accountMode.current = false;
        syncLocal();
        return;
      }
      const list = await accountList();
      if (!alive) return;
      if (list === null) {
        // Account unavailable (e.g. table not migrated yet) — act like local.
        accountMode.current = false;
        setEntries(fromLocal());
        return;
      }
      // One-time migration of any local saves into the account.
      const local = readSaved().filter((i) => i.path);
      if (local.length) {
        await Promise.allSettled(
          local.map((i) =>
            accountSave({
              id: i.id,
              path: i.path,
              title: i.title,
              subtitle: i.subtitle,
              image: i.image ?? null,
            }),
          ),
        );
        clearSaved();
      }
      const merged = local.length ? await accountList() : list;
      if (!alive) return;
      accountMode.current = true;
      setEntries(merged ?? list);
    })();

    return () => {
      alive = false;
      window.removeEventListener(SAVED_EVENT, syncLocal);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACCOUNT_EVENT, onAccount);
    };
  }, [status]);

  const isSaved = useCallback(
    (ref: string) => (entries ?? []).some((e) => e.ref === ref),
    [entries],
  );

  const toggle = useCallback(
    async (item: SavedInput): Promise<boolean> => {
      const ref = item.id;
      const saved = (entries ?? []).some((e) => e.ref === ref);
      if (!accountMode.current) {
        if (saved) removeLocal(ref);
        else saveLocal(item);
        return !saved;
      }
      // Optimistic account update.
      setEntries((prev) => {
        const list = prev ?? [];
        return saved
          ? list.filter((e) => e.ref !== ref)
          : [
              {
                ref,
                path: item.path,
                title: item.title,
                subtitle: item.subtitle,
                image: item.image ?? null,
                savedAt: new Date().toISOString(),
              },
              ...list,
            ];
      });
      try {
        if (saved) await accountRemove(ref);
        else await accountSave(item);
        window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
      } catch {
        const l = await accountList();
        if (l) setEntries(l);
      }
      return !saved;
    },
    [entries],
  );

  const remove = useCallback(async (ref: string) => {
    if (!accountMode.current) {
      removeLocal(ref);
      return;
    }
    setEntries((prev) => (prev ?? []).filter((e) => e.ref !== ref));
    try {
      await accountRemove(ref);
      window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
    } catch {
      const l = await accountList();
      if (l) setEntries(l);
    }
  }, []);

  return { entries, loading: entries === null, isSaved, toggle, remove };
}
