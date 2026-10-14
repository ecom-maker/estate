import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { assertPermission } from "@/lib/rbac/guards";
import { prisma } from "@/lib/db/prisma";
import { setUnitHidden } from "@/app/admin/properties/actions";
import { UnitTypeSelect } from "@/components/admin/unit-type-select";
import { UnitListingSelect } from "@/components/admin/unit-listing-select";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Units" };

export default async function AdminUnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await assertPermission("properties.view");
  } catch {
    redirect("/login?next=/admin/units");
  }

  const qRaw = (await searchParams).q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";
  const where: Prisma.PropertyUnitWhereInput = {
    property: { deletedAt: null },
    ...(q
      ? {
          OR: [
            { unitNumber: { contains: q, mode: "insensitive" as const } },
            {
              property: { title: { contains: q, mode: "insensitive" as const } },
            },
            { status: { contains: q, mode: "insensitive" as const } },
            { view: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  let units: Array<{
    id: string;
    unitNumber: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    priceAed: number | null;
    status: string | null;
    hidden: boolean;
    unitType: string | null;
    metadata: Prisma.JsonValue;
    property: { id: string; title: string; type: string };
  }> = [];
  let total = 0;
  try {
    [units, total] = await Promise.all([
      prisma.propertyUnit.findMany({
        where,
        orderBy: [{ property: { title: "asc" } }, { unitNumber: "asc" }],
        take: 500,
        select: {
          id: true,
          unitNumber: true,
          bedrooms: true,
          bathrooms: true,
          areaSqft: true,
          priceAed: true,
          status: true,
          hidden: true,
          unitType: true,
          metadata: true,
          property: { select: { id: true, title: true, type: true } },
        },
      }),
      prisma.propertyUnit.count({ where }),
    ]);
  } catch {
    units = [];
    total = 0;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Units
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Units</h1>
      <p className="mt-2 text-sm text-muted">
        {q ? (
          <>
            {total} unit{total === 1 ? "" : "s"} matching “{q}”.{" "}
            <Link href="/admin/units" className="text-accent hover:underline">
              Clear
            </Link>
          </>
        ) : (
          <>
            {total} individual units across all projects. Unit numbers are
            admin-only — never shown to the public or the AI assistant. Edit a
            unit&apos;s project to manage it.
          </>
        )}
      </p>

      <form method="get" className="mt-6 flex max-w-md items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by unit number, project, status…"
          aria-label="Search units"
          className="w-full rounded-sm border border-border bg-card px-4 py-2.5 text-sm text-primary outline-none ring-accent focus:ring-2"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Unit #</th>
              <th>Project</th>
              <th>Type</th>
              <th>Deal</th>
              <th>Beds</th>
              <th>Bath</th>
              <th>Area (sqft)</th>
              <th>Price (AED)</th>
              <th>Status</th>
              <th>Visibility</th>
              <th className="px-4">Manage</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr
                key={u.id}
                className={`border-t border-border ${u.hidden ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-primary">
                  {u.unitNumber}
                </td>
                <td className="max-w-[240px] truncate">{u.property.title}</td>
                <td>
                  <UnitTypeSelect
                    id={u.id}
                    value={u.unitType}
                    projectType={u.property.type}
                  />
                </td>
                <td>
                  <UnitListingSelect
                    id={u.id}
                    value={
                      (u.metadata as { listing?: string } | null)?.listing ??
                      "sale"
                    }
                  />
                </td>
                <td>{u.bedrooms ?? "—"}</td>
                <td>{u.bathrooms ?? "—"}</td>
                <td>
                  {u.areaSqft ? Math.round(u.areaSqft).toLocaleString() : "—"}
                </td>
                <td>
                  {u.priceAed ? Math.round(u.priceAed).toLocaleString() : "—"}
                </td>
                <td className="capitalize">{u.status ?? "—"}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      u.hidden
                        ? "bg-primary/10 text-muted"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {u.hidden ? "Hidden" : "Visible"}
                  </span>
                </td>
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <form action={setUnitHidden}>
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        type="hidden"
                        name="hidden"
                        value={String(!u.hidden)}
                      />
                      <button
                        type="submit"
                        className="font-medium text-accent hover:underline"
                      >
                        {u.hidden ? "Show" : "Hide"}
                      </button>
                    </form>
                    <Link
                      href={`/admin/properties/${u.property.id}/edit`}
                      className="text-muted hover:text-accent"
                    >
                      Project
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {units.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={11} className="px-4 py-6 text-muted">
                  {q ? `No units match “${q}”.` : "No units yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
