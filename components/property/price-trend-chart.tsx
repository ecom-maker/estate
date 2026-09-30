"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  months: string[];
  primary: number[];
  secondary: number[];
  primaryLabel: string;
  secondaryLabel: string;
};

const RANGES = [
  { id: "1Y", months: 12 },
  { id: "2Y", months: 24 },
  { id: "5Y", months: 60 },
] as const;

const W = 900;
const H = 320;
const PAD = { top: 20, right: 20, bottom: 34, left: 52 };

export function PriceTrendChart({
  months,
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("1Y");

  const view = useMemo(() => {
    const n = RANGES.find((r) => r.id === range)?.months ?? 12;
    const slice = <T,>(a: T[]) => a.slice(Math.max(0, a.length - n));
    const p = slice(primary);
    const s = slice(secondary);
    const m = slice(months);
    const all = [...p, ...s];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.15 || max * 0.1;
    const lo = Math.max(0, min - pad);
    const hi = max + pad;

    const x = (i: number, len: number) =>
      PAD.left + (i / Math.max(1, len - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
    const toPath = (arr: number[]) =>
      arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i, arr.length)},${y(v)}`).join(" ");

    // 4 y gridlines
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);
    // ~6 x labels
    const step = Math.max(1, Math.round(m.length / 6));
    const xlabels = m
      .map((label, i) => ({ label, i }))
      .filter(({ i }) => i % step === 0 || i === m.length - 1);

    return { p, s, m, x, y, toPath, ticks, xlabels };
  }, [range, months, primary, secondary]);

  const fmtK = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${Math.round(v)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="h-0.5 w-5 rounded bg-primary" />
            {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-0.5 w-5 rounded bg-accent" />
            {secondaryLabel}
          </span>
        </div>
        <div className="inline-flex rounded-full border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                range === r.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-primary",
              )}
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Price per sqft trend for ${primaryLabel}`}
      >
        {view.ticks.map((t, i) => {
          const y = view.y(t);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted text-[11px]"
              >
                {fmtK(t)}
              </text>
            </g>
          );
        })}

        {view.xlabels.map(({ label, i }) => (
          <text
            key={i}
            x={view.x(i, view.m.length)}
            y={H - 12}
            textAnchor="middle"
            className="fill-muted text-[11px]"
          >
            {label}
          </text>
        ))}

        <polyline
          points={view.s
            .map((v, i) => `${view.x(i, view.s.length)},${view.y(v)}`)
            .join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <polyline
          points={view.p
            .map((v, i) => `${view.x(i, view.p.length)},${view.y(v)}`)
            .join(" ")}
          fill="none"
          className="stroke-primary"
          strokeWidth={2.5}
        />
      </svg>
      <p className="mt-2 text-center text-[11px] text-muted">AED / sqft</p>
    </div>
  );
}
