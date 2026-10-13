import Link from "next/link";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Units" };

export default async function AdminUnitsPage() {
  try {
    await assertPermission("properties.view");
  } catch {
    redirect("/login?next=/admin/units");
  }

  let units: Array<{
    id: string;
    unitNumber: string;
    bedrooms: number | null;
    bathrooms: number | null;
    areaSqft: number | null;
    priceAed: number | null;
    status: string | null;
    property: { id: string; title: string };
  }> = [];
  let total = 0;
  try {
    [units, total] = await Promise.all([
      prisma.propertyUnit.findMany({
        where: { property: { deletedAt: null } },
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
          property: { select: { id: true, title: true } },
        },
      }),
      prisma.propertyUnit.count({ where: { property: { deletedAt: null } } }),
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
        {total} individual units across all projects. Unit numbers are
        admin-only — never shown to the public or the AI assistant. Edit a
        unit&apos;s project to manage it.
      </p>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Unit #</th>
              <th>Project</th>
              <th>Beds</th>
              <th>Bath</th>
              <th>Area (sqft)</th>
              <th>Price (AED)</th>
              <th>Status</th>
              <th className="px-4">Manage</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-primary">
                  {u.unitNumber}
                </td>
                <td className="max-w-[240px] truncate">{u.property.title}</td>
                <td>{u.bedrooms ?? "—"}</td>
                <td>{u.bathrooms ?? "—"}</td>
                <td>
                  {u.areaSqft ? Math.round(u.areaSqft).toLocaleString() : "—"}
                </td>
                <td>
                  {u.priceAed ? Math.round(u.priceAed).toLocaleString() : "—"}
                </td>
                <td className="capitalize">{u.status ?? "—"}</td>
                <td className="px-4">
                  <Link
                    href={`/admin/properties/${u.property.id}/edit`}
                    className="font-medium text-accent hover:underline"
                  >
                    Project
                  </Link>
                </td>
              </tr>
            ))}
            {units.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={8} className="px-4 py-6 text-muted">
                  No units yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
