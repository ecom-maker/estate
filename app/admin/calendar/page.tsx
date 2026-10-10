import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

type Viewing = {
  id: string;
  name: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  status: string;
  property: { title: string; slug: string; offPlan: boolean } | null;
};

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/calendar");
  }

  const now = new Date();
  const { y: yParam, m: mParam } = await searchParams;
  let year = Number(yParam);
  let month = Number(mParam); // 1-12
  if (!Number.isInteger(year) || year < 1970 || year > 3000)
    year = now.getFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12)
    month = now.getMonth() + 1;

  const ym = `${year}-${pad(month)}`;

  // Confirmed viewings fall on their preferred date (agent stores YYYY-MM-DD).
  let viewings: Viewing[] = [];
  try {
    viewings = await prisma.lead.findMany({
      where: {
        kind: "viewing",
        status: { not: "closed" },
        preferredDate: { startsWith: ym },
      },
      orderBy: { preferredDate: "asc" },
      select: {
        id: true,
        name: true,
        preferredDate: true,
        preferredTime: true,
        status: true,
        property: { select: { title: true, slug: true, offPlan: true } },
      },
    });
  } catch {
    viewings = [];
  }

  // Group by day-of-month.
  const byDay = new Map<number, Viewing[]>();
  for (const v of viewings) {
    const d = Number(v.preferredDate?.slice(8, 10));
    if (!d) continue;
    const list = byDay.get(d) ?? [];
    list.push(v);
    byDay.set(d, list);
  }

  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first leading blanks
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    year === now.getFullYear() &&
    month === now.getMonth() + 1 &&
    d === now.getDate();

  const title = first.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Navigation targets.
  const prevM = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const href = (y: number, m: number) => `/admin/calendar?y=${y}&m=${m}`;

  const NavBtn = ({
    to,
    label,
    children,
  }: {
    to: string;
    label: string;
    children: React.ReactNode;
  }) => (
    <Link
      href={to}
      aria-label={label}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-sm border border-border bg-card px-2.5 text-sm text-primary transition hover:border-accent"
    >
      {children}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Calendar
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl text-primary">{title}</h1>
        <div className="flex items-center gap-2">
          <NavBtn to={href(year - 1, month)} label="Previous year">
            «
          </NavBtn>
          <NavBtn to={href(prevM.y, prevM.m)} label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </NavBtn>
          <Link
            href="/admin/calendar"
            className="inline-flex h-9 items-center rounded-sm border border-border bg-card px-3 text-sm text-primary transition hover:border-accent"
          >
            Today
          </Link>
          <NavBtn to={href(nextM.y, nextM.m)} label="Next month">
            <ChevronRight className="h-4 w-4" />
          </NavBtn>
          <NavBtn to={href(year + 1, month)} label="Next year">
            »
          </NavBtn>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {viewings.length} {viewings.length === 1 ? "viewing" : "viewings"} this
        month.
      </p>

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
          const dayViewings = d ? (byDay.get(d) ?? []) : [];
          return (
            <div
              key={i}
              className={`min-h-28 bg-background p-1.5 ${d ? "" : "bg-card/40"}`}
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
                      <Link
                        key={v.id}
                        href={
                          v.property
                            ? `/${v.property.offPlan ? "projects" : "properties"}/${v.property.slug}`
                            : "/admin/leads"
                        }
                        className="block rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-1 text-[11px] leading-tight text-primary transition hover:border-accent"
                        title={`${v.property?.title ?? "Viewing"} — ${v.name ?? "Unknown"}${v.preferredTime ? ` · ${v.preferredTime}` : ""} (${v.status})`}
                      >
                        {v.preferredTime ? (
                          <span className="font-medium">{v.preferredTime} · </span>
                        ) : null}
                        <span className="font-medium">
                          {v.property?.title ?? "Viewing"}
                        </span>
                        <span className="block truncate text-muted">
                          {v.name ?? "Unknown"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Viewings are property-viewing requests booked by customers (via the
        assistant or an agent). Cancelled viewings are hidden.
      </p>
    </div>
  );
}
