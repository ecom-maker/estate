"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { rescheduleViewing } from "@/app/admin/calendar/actions";

export type CalViewing = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string | null;
  status: string;
  propertyTitle: string | null;
  propertyHref: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

export function CalendarBoard({
  viewings: initial,
  year,
  month,
}: {
  viewings: CalViewing[];
  year: number;
  month: number; // 1-12
}) {
  const [viewings, setViewings] = useState<CalViewing[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = viewings.find((v) => v.id === selectedId) ?? null;

  const byDate = useMemo(() => {
    const map = new Map<string, CalViewing[]>();
    for (const v of viewings) {
      const list = map.get(v.preferredDate) ?? [];
      list.push(v);
      map.set(v.preferredDate, list);
    }
    return map;
  }, [viewings]);

  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const now = new Date();
  const isToday = (d: number) =>
    year === now.getFullYear() && month === now.getMonth() + 1 && d === now.getDate();
  const dateStr = (d: number) => `${year}-${pad(month)}-${pad(d)}`;

  /** Persist a date/time change with optimistic UI and revert on failure. */
  function persist(id: string, date: string, time: string | null) {
    const prev = viewings;
    setViewings((vs) =>
      vs.map((v) =>
        v.id === id ? { ...v, preferredDate: date, preferredTime: time } : v,
      ),
    );
    setError(null);
    startTransition(async () => {
      const res = await rescheduleViewing(id, date, time);
      if (!res.ok) {
        setViewings(prev); // revert
        setError(res.error ?? "Could not save the change.");
      }
    });
  }

  function onDrop(day: number) {
    setDragOverDate(null);
    if (!dragId) return;
    const v = viewings.find((x) => x.id === dragId);
    setDragId(null);
    if (!v) return;
    const target = dateStr(day);
    if (v.preferredDate === target) return;
    persist(v.id, target, v.preferredTime);
  }

  return (
    <>
      {error ? (
        <p className="mt-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-7 gap-px overflow-hidden rounded-sm border border-border bg-border">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-card px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const date = d ? dateStr(d) : "";
          const dayViewings = d ? (byDate.get(date) ?? []) : [];
          const isOver = d != null && dragOverDate === date;
          return (
            <div
              key={i}
              onDragOver={(e) => {
                if (!d || !dragId) return;
                e.preventDefault();
                if (dragOverDate !== date) setDragOverDate(date);
              }}
              onDragLeave={() => {
                if (dragOverDate === date) setDragOverDate(null);
              }}
              onDrop={() => d && onDrop(d)}
              className={`min-h-28 p-1.5 transition-colors ${
                d ? "bg-background" : "bg-card/40"
              } ${isOver ? "ring-2 ring-inset ring-accent" : ""}`}
            >
              {d ? (
                <>
                  <div
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday(d)
                        ? "bg-accent font-semibold text-white"
                        : "text-muted"
                    }`}
                  >
                    {d}
                  </div>
                  <div className="space-y-1">
                    {dayViewings.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        draggable
                        onDragStart={() => setDragId(v.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOverDate(null);
                        }}
                        onClick={() => setSelectedId(v.id)}
                        className={`block w-full cursor-grab rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-1 text-left text-[11px] leading-tight text-primary transition hover:border-accent active:cursor-grabbing ${
                          dragId === v.id ? "opacity-50" : ""
                        }`}
                        title="Click for details · drag to another day to reschedule"
                      >
                        {v.preferredTime ? (
                          <span className="font-medium">{v.preferredTime} · </span>
                        ) : null}
                        <span className="font-medium">
                          {v.propertyTitle ?? "Viewing"}
                        </span>
                        <span className="block truncate text-muted">
                          {v.name ?? "Unknown"}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Click a viewing for details or to edit its date/time. Drag a viewing to
        another day to reschedule it. Cancelled viewings are hidden.
      </p>

      {selected ? (
        <ViewingModal
          viewing={selected}
          onClose={() => setSelectedId(null)}
          onSave={(date, time) => {
            persist(selected.id, date, time);
            setSelectedId(null);
          }}
        />
      ) : null}
    </>
  );
}

function ViewingModal({
  viewing,
  onClose,
  onSave,
}: {
  viewing: CalViewing;
  onClose: () => void;
  onSave: (date: string, time: string | null) => void;
}) {
  const [date, setDate] = useState(viewing.preferredDate);
  const [time, setTime] = useState(viewing.preferredTime ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-serif text-xl text-primary">Viewing details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted transition hover:bg-accent/10 hover:text-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Property">
            {viewing.propertyHref ? (
              <Link
                href={viewing.propertyHref}
                target="_blank"
                className="text-accent hover:underline"
              >
                {viewing.propertyTitle ?? "—"}
              </Link>
            ) : (
              (viewing.propertyTitle ?? "—")
            )}
          </Row>
          <Row label="Name">{viewing.name ?? "—"}</Row>
          <Row label="Phone">{viewing.phone ?? "—"}</Row>
          <Row label="Email">{viewing.email ?? "—"}</Row>
          <Row label="Status">
            <span className="capitalize">{viewing.status}</span>
          </Row>
        </dl>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Reschedule
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-sm border border-border bg-background px-3 py-2 text-sm text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Time
              <input
                type="text"
                value={time}
                placeholder="e.g. 14:00"
                onChange={(e) => setTime(e.target.value)}
                className="w-32 rounded-sm border border-border bg-background px-3 py-2 text-sm text-primary outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
              onClick={() => onSave(date, time.trim() || null)}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-primary">{children}</dd>
    </div>
  );
}
