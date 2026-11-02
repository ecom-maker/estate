"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  MapPin,
  LayoutGrid,
  Download,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/components/auth/sign-in-gate";
import { isMasterplanImage } from "@/lib/property/masterplan";

type Img = { url: string; alt?: string | null };

export function ProjectGallery({
  images,
  title,
  mapQuery,
  coords,
  brochureUrl,
  masterplanUrl,
}: {
  images: Img[];
  title: string;
  mapQuery?: string;
  coords?: { lat: number; lng: number } | null;
  brochureUrl?: string | null;
  masterplanUrl?: string | null;
}) {
  const [index, setIndex] = useState<number | null>(null);
  // Downloading the brochure requires a signed-in visitor (same gate as search).
  const requireAuth = useRequireAuth();
  const [view, setView] = useState<"photos" | "masterplan">("photos");
  // The masterplan has its own tab, so it never sits among the photos.
  const photos = images.filter((img) => img.url !== masterplanUrl && !isMasterplanImage(img));
  const plans: Img[] = masterplanUrl ? [{ url: masterplanUrl, alt: `${title} masterplan` }] : [];
  const shown = view === "masterplan" ? plans : photos;
  const count = shown.length;

  const open = (tab: "photos" | "masterplan", i = 0) => {
    setView(tab);
    setIndex(i);
  };

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + count) % count)),
    [count],
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % count)),
    [count],
  );

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, close, prev, next]);

  if (!photos.length) return null;

  const hero = photos[0];
  const side = photos.slice(1, 5);

  return (
    <>
      {/* Grid: large hero + up to 4 side tiles */}
      <div
        className={cn(
          "mt-8 grid gap-2",
          side.length ? "md:grid-cols-2" : "",
        )}
      >
        <button
          type="button"
          onClick={() => open("photos")}
          className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-primary/10"
        >
          <Image
            src={hero.url}
            alt={hero.alt ?? title}
            fill
            priority
            sizes="(max-width:768px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
          {/* Brochure / Floor plans / Map overlay */}
          <span className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
            {brochureUrl ? (
              <span
                role="link"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!brochureUrl) return;
                  const url = brochureUrl;
                  // Open in a new tab only, never the current one. An anchor
                  // click is used instead of window.open(..., "noopener"),
                  // which returns null on success and so can't be branched on.
                  void requireAuth(
                    () => {
                      const a = document.createElement("a");
                      a.href = url;
                      a.target = "_blank";
                      a.rel = "noopener noreferrer";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    },
                    {
                      title: "Sign in to download",
                      message:
                        "Sign in to download the brochure for this project.",
                    },
                  );
                }}
                className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Download brochure
              </span>
            ) : null}
            <span
              role="link"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                document
                  .getElementById("units")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Floor plans
            </span>
            {plans.length ? (
              <span
                role="link"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  open("masterplan");
                }}
                className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
              >
                <MapIcon className="h-3.5 w-3.5" /> Master plan
              </span>
            ) : null}
            {mapQuery ? (
              <span
                role="link"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
                    "_blank",
                    "noopener",
                  );
                }}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
              >
                <MapPin className="h-3.5 w-3.5" /> Map
              </span>
            ) : null}
            {coords ? (
              <span
                role="link"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  // Resolve the official (outdoor) Street View panorama server
                  // side, then redirect — a plain pano URL would snap to the
                  // nearest 360 photo, which can be a user upload on a balcony.
                  window.open(
                    `/api/streetview?lat=${coords.lat}&lng=${coords.lng}`,
                    "_blank",
                    "noopener",
                  );
                }}
                className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
              >
                <Camera className="h-3.5 w-3.5" /> Street view
              </span>
            ) : null}
          </span>
        </button>

        {side.length ? (
          <div className="grid grid-cols-2 gap-2">
            {side.map((img, i) => {
              const isLast = i === side.length - 1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => open("photos", i + 1)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-primary/10"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? title}
                    fill
                    sizes="25vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  {isLast && photos.length > 5 ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/55 text-sm font-semibold text-white">
                      <Camera className="mr-1.5 h-4 w-4" />
                      {photos.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Lightbox */}
      {index !== null ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95">
          <div className="flex items-center justify-between p-4">
            <div className="flex gap-2">
              {plans.length
                ? (
                    [
                      ["photos", `Photos (${photos.length})`],
                      ["masterplan", `Master plan (${plans.length})`],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => open(tab)}
                      aria-pressed={view === tab}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-medium transition",
                        view === tab
                          ? "bg-white text-primary"
                          : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {label}
                    </button>
                  ))
                : null}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 sm:px-16">
            {count > 1 ? (
              <button
                type="button"
                onClick={prev}
                aria-label="Previous"
                className="absolute left-2 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:left-6"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            ) : null}

            <div className="relative h-full max-h-[70vh] w-full max-w-4xl">
              <Image
                src={shown[index].url}
                alt={shown[index].alt ?? title}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>

            {count > 1 ? (
              <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="absolute right-2 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:right-6"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            ) : null}
          </div>

          <p className="py-3 text-center text-sm text-white/80">
            {index + 1} / {count}
          </p>

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-5">
            {shown.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className={cn(
                  "relative h-16 w-24 shrink-0 overflow-hidden rounded-sm transition",
                  i === index
                    ? "ring-2 ring-white"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
