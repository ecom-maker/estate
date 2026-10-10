import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { CalendarBoard, type CalViewing } from "@/components/admin/calendar-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

const pad = (n: number) => String(n).padStart(2, "0");

type Viewing = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
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
        phone: true,
        email: true,
        preferredDate: true,
        preferredTime: true,
        status: true,
        property: { select: { title: true, slug: true, offPlan: true } },
      },
    });
  } catch {
    viewings = [];
  }

  // Shape for the interactive board (only rows with a valid YYYY-MM-DD date).
  const boardViewings: CalViewing[] = viewings
    .filter((v) => v.preferredDate && /^\d{4}-\d{2}-\d{2}/.test(v.preferredDate))
    .map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      email: v.email,
      preferredDate: v.preferredDate!.slice(0, 10),
      preferredTime: v.preferredTime,
      status: v.status,
      propertyTitle: v.property?.title ?? null,
      propertyHref: v.property
        ? `/${v.property.offPlan ? "projects" : "properties"}/${v.property.slug}`
        : null,
    }));

  const first = new Date(year, month - 1, 1);
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
        {boardViewings.length}{" "}
        {boardViewings.length === 1 ? "viewing" : "viewings"} this month.
      </p>

      <CalendarBoard viewings={boardViewings} year={year} month={month} />
    </div>
  );
}
