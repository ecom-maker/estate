import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { formatAED } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Properties" };

export default async function AdminPropertiesPage() {
  try {
    await assertPermission("properties.update");
  } catch {
    redirect("/login?next=/admin/properties");
  }

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
      where: { deletedAt: null },
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
        <Link
          href="/admin/properties/new"
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          + New property
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
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
