"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";

// A few luxury gradients; the project title picks one deterministically so a
// given project always shows the same backdrop and adjacent cards differ.
const GRADIENTS = [
  "from-[#1f2937] via-[#374151] to-[#b08d57]",
  "from-[#0f172a] via-[#334155] to-[#c9a24b]",
  "from-[#1a1a2e] via-[#16213e] to-[#a1763a]",
  "from-[#2d2a32] via-[#413c47] to-[#caa15a]",
  "from-[#14281d] via-[#28402f] to-[#b8974e]",
];

function pick(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function initials(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "DM";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Fallback({ title }: { title: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${pick(title)}`}
    >
      <Building2 className="h-7 w-7 text-white/40" aria-hidden />
      <span className="mt-2 font-serif text-3xl tracking-wide text-white/90">
        {initials(title)}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-white/50">
        DM Global
      </span>
    </div>
  );
}

export function ProjectImage({
  url,
  alt,
  title,
}: {
  url: string | null;
  alt: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // onError can be missed when the image already failed before React hydrated,
  // so also check for a broken image (loaded, zero intrinsic size) on mount.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  if (!url || failed) return <Fallback title={title} />;
  return (
    <Image
      ref={ref}
      src={url}
      alt={alt ?? title}
      fill
      sizes="(max-width:768px) 100vw, 45vw"
      className="object-cover transition duration-500 group-hover:scale-[1.02]"
      onError={() => setFailed(true)}
    />
  );
}
