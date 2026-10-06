import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { formatAED } from "@/lib/utils";
import { BackfillCommunitiesButton } from "@/components/admin/backfill-communities-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Properties" };

type Filter = "all" | "ready" | "offplan" | "active";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Properties" },
  { key: "offplan", label: "Projects (off-plan)" },
  { key: "active", label: "Active" },
];

function whereForFilter(filter: Filter): Prisma.PropertyWhereInput {
  const base: Prisma.PropertyWhereInput = { deletedAt: null };
  if (filter === "ready") return { ...base, offPlan: false };
  if (filter === "offplan") return { ...base, offPlan: true };
  if (filter === "active") return { ...base, status: "ACTIVE" };
  return base;
}

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  try {
    await assertPermission("properties.update");
  } catch {
    redirect("/login?next=/admin/properties");
  }

  const { filter: filterParam } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === filterParam)
    ? (filterParam as Filter)
    : "all";

  let properties: Array<{
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    priceAed: number | null;
    bedrooms: number | null;
    community: { name: string } | null;
  }> = [];

  try {
    properties = await prisma.property.findMany({
      where: whereForFilter(filter),
      include: { community: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  } catch {
    properties = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Admin · Properties
          </p>
          <h1 className="mt-3 font-serif text-4xl text-primary">Properties</h1>
          <p className="mt-2 text-sm text-muted">
            {properties.length} listings · create and edit manually, or sync via
            connectors.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/admin/properties/new"
            className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            + New property
          </Link>
          <BackfillCommunitiesButton />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/properties" : `/admin/properties?filter=${f.key}`}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent hover:text-primary"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th>Type</th>
              <th>Community</th>
              <th>Beds</th>
              <th>Price</th>
              <th>Status</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link
                    href={`/properties/${property.slug}`}
                    className="text-primary hover:text-accent"
                  >
                    {property.title}
                  </Link>
                </td>
                <td>{property.type}</td>
                <td>{property.community?.name ?? "—"}</td>
                <td>{property.bedrooms ?? "—"}</td>
                <td>{formatAED(property.priceAed)}</td>
                <td>{property.status}</td>
                <td className="px-4">
                  <Link
                    href={`/admin/properties/${property.id}/edit`}
                    className="font-medium text-accent hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {properties.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={7} className="px-4 py-6 text-muted">
                  No properties yet.{" "}
                  <Link
                    href="/admin/properties/new"
                    className="text-accent hover:underline"
                  >
                    Create the first one
                  </Link>
                  .
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
