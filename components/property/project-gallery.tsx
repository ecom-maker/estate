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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Img = { url: string; alt?: string | null };

export function ProjectGallery({
  images,
  title,
  mapQuery,
}: {
  images: Img[];
  title: string;
  mapQuery?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const count = images.length;

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

  if (!count) return null;

  const hero = images[0];
  const side = images.slice(1, 5);

  return (
    <>
      {/* Grid: large hero + up to 4 side tiles */}
      <div
        className={cn(
          "mt-8 grid gap-2",
          side.length ? "md:grid-cols-[1.7fr_1fr]" : "",
        )}
      >
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="group relative aspect-[16/10] overflow-hidden rounded-sm bg-primary/10"
        >
          <Image
            src={hero.url}
            alt={hero.alt ?? title}
            fill
            priority
            sizes="(max-width:768px) 100vw, 55vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
          {/* Floor plans / Map overlay */}
          <span className="pointer-events-none absolute bottom-3 left-3 flex gap-2">
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
                  onClick={() => setIndex(i + 1)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-sm bg-primary/10"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? title}
                    fill
                    sizes="25vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  {isLast && count > 5 ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/55 text-sm font-semibold text-white">
                      <Camera className="mr-1.5 h-4 w-4" />
                      {count}
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
          <div className="flex items-center justify-end p-4">
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
                src={images[index].url}
                alt={images[index].alt ?? title}
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
            {images.map((img, i) => (
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
