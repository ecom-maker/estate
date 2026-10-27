"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Heart,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Share,
  X,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

/** Facebook brand mark (lucide dropped logo icons). */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

/** X (formerly Twitter) brand mark. */
function XBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

type ShareSaveBarProps = {
  /** Stable id used for the saved-items list (the project/unit slug). */
  shareId: string;
  /** Title shown in the share sheet and used by native share. */
  title: string;
  /** One-line facts under the title (e.g. "Downtown Dubai · from AED …"). */
  subtitle?: string;
  /** Optional thumbnail for the share sheet. */
  imageUrl?: string | null;
  /** Canonical path to share (e.g. "/projects/slug"); absolute URL built client-side. */
  path: string;
  /** Noun for the share-sheet heading, e.g. "project" (default) or "property". */
  entityLabel?: string;
  /** Classes for the trigger row (override to place it inline with the title). */
  className?: string;
};

const SAVED_KEY = "dmg:saved";

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    /* private mode / blocked storage — ignore */
  }
}

export function ShareSaveBar({
  shareId,
  title,
  subtitle,
  imageUrl,
  path,
  entityLabel = "project",
  className,
}: ShareSaveBarProps) {
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(path);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate saved state and the absolute share URL on the client.
  useEffect(() => {
    setSaved(readSaved().includes(shareId));
    setUrl(window.location.origin + path);
  }, [shareId, path]);

  // Close the share sheet on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  function toggleSave() {
    setSaved((prev) => {
      const next = !prev;
      const ids = readSaved();
      writeSaved(next ? [...new Set([...ids, shareId])] : ids.filter((id) => id !== shareId));
      return next;
    });
  }

  function copyLink() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    });
  }

  async function openShare() {
    // Prefer the OS share sheet on devices that support it (mobile), fall back
    // to the custom popup elsewhere.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: subtitle, url });
        return;
      } catch {
        // User dismissed or share failed — show the popup instead.
      }
    }
    setOpen(true);
  }

  const shareText = encodeURIComponent(`${title}${subtitle ? ` — ${subtitle}` : ""}`);
  const encodedUrl = encodeURIComponent(url);

  const options = [
    {
      label: "Copy Link",
      icon: copied ? (
        <Check className="h-5 w-5" />
      ) : (
        <Copy className="h-5 w-5" />
      ),
      onClick: copyLink,
    },
    {
      label: "Email",
      icon: <Mail className="h-5 w-5" />,
      href: `mailto:?subject=${shareText}&body=${shareText}%0A%0A${encodedUrl}`,
    },
    {
      label: "Messages",
      icon: <MessageSquare className="h-5 w-5" />,
      href: `sms:?&body=${shareText}%20${encodedUrl}`,
    },
    {
      label: "WhatsApp",
      icon: <WhatsAppIcon className="h-5 w-5" />,
      href: `https://wa.me/?text=${shareText}%20${encodedUrl}`,
    },
    {
      label: "Facebook",
      icon: <FacebookIcon className="h-5 w-5" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "X",
      icon: <XBrandIcon className="h-5 w-5" />,
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`,
    },
  ];

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-primary underline-offset-4 transition hover:underline";

  return (
    <>
      <div className={cn("mt-4 flex items-center gap-4", className)}>
        <button type="button" onClick={openShare} className={btnClass} aria-label="Share">
          <Share className="h-4 w-4" />
          Share
        </button>
        <button
          type="button"
          onClick={toggleSave}
          className={btnClass}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save"}
        >
          <Heart
            className={cn("h-4 w-4", saved && "fill-accent text-accent")}
          />
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Share this ${entityLabel}`}
        >
          <div
            className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-muted transition hover:text-primary"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-serif text-2xl text-primary">
              Share this {entityLabel}
            </h2>

            <div className="mt-4 flex items-center gap-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-14 w-14 flex-none rounded-lg object-cover"
                />
              ) : null}
              <p className="text-sm text-muted">
                <span className="font-medium text-primary">{title}</span>
                {subtitle ? <> · {subtitle}</> : null}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {options.map((opt) =>
                opt.href ? (
                  <a
                    key={opt.label}
                    href={opt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-primary transition hover:border-primary/40 hover:bg-background"
                  >
                    {opt.icon}
                    {opt.label}
                  </a>
                ) : (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={opt.onClick}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-primary transition hover:border-primary/40 hover:bg-background"
                  >
                    {opt.icon}
                    {opt.label === "Copy Link" && copied ? "Copied!" : opt.label}
                  </button>
                ),
              )}
              {typeof navigator !== "undefined" &&
              typeof navigator.share === "function" ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator
                      .share({ title, text: subtitle, url })
                      .catch(() => {});
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-primary transition hover:border-primary/40 hover:bg-background sm:col-span-2"
                >
                  <MoreHorizontal className="h-5 w-5" />
                  More options
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
