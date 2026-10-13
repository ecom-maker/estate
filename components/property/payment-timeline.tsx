import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Payment plan and project timeline for a project, shared by the project page
 * and its unit pages so both show the same thing. Only data on file is shown:
 * no invented payment splits, no undated milestones.
 */

type ProjectFacts = {
  offPlan: boolean;
  paymentPlan: unknown;
  metadata: unknown;
};

export function PaymentPlanSection({ project }: { project: ProjectFacts }) {
  // Only relevant for off-plan projects.
  if (!project.offPlan) return null;
  const pp = (project.paymentPlan ?? {}) as {
    downPaymentPct?: number;
    duringConstructionPct?: number;
    onHandoverPct?: number;
  };
  const steps = [
    { pct: pp.downPaymentPct, label: "Down payment", sub: "At sales launch" },
    { pct: pp.duringConstructionPct, label: "During construction", sub: null },
    { pct: pp.onHandoverPct, label: "On handover", sub: null },
  ].filter(
    (s): s is { pct: number; label: string; sub: string | null } =>
      typeof s.pct === "number",
  );
  if (!steps.length) return null;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-primary">Payment plan</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div className="flex-1 rounded-sm border border-border bg-card p-5 text-center">
              <p className="font-serif text-2xl text-primary">{s.pct}%</p>
              <p className="mt-1 text-sm font-medium text-primary">{s.label}</p>
              {s.sub ? <p className="mt-0.5 text-xs text-muted">{s.sub}</p> : null}
            </div>
            {i < steps.length - 1 ? (
              <span className="hidden text-lg text-muted sm:block" aria-hidden>
                ›
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

const fmtLong = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export function ProjectTimelineSection({ project }: { project: ProjectFacts }) {
  const meta = (project.metadata ?? {}) as {
    handoverDate?: string;
    timeline?: { announced?: string; constructionStart?: string; completion?: string };
  };
  const tl = meta.timeline ?? {};
  const isCompleted = !project.offPlan;
  // For completed projects the final milestone is the handover date.
  const completionRaw = isCompleted
    ? meta.handoverDate ?? tl.completion
    : tl.completion ?? meta.handoverDate;
  const milestones = [
    { title: "Project announcement", date: fmtLong(tl.announced), done: true },
    { title: "Construction started", date: fmtLong(tl.constructionStart), done: true },
    isCompleted
      ? { title: "Completed", date: fmtLong(completionRaw), done: true }
      : { title: "Expected completion", date: fmtLong(completionRaw), done: false },
  ].filter((m) => m.date);
  if (!milestones.length) return null;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-primary">Project timeline</h2>
      <ol className="mt-4 rounded-sm border border-border bg-card p-6">
        {milestones.map((m, i) => (
          <li key={m.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < milestones.length - 1 ? (
              <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px]",
                m.done ? "border-accent bg-accent text-white" : "border-border bg-card text-transparent",
              )}
              aria-hidden
            >
              ✓
            </span>
            <div className="pt-0.5">
              <p className="text-sm font-medium text-primary">{m.title}</p>
              <p className="text-sm text-muted">{m.date}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
