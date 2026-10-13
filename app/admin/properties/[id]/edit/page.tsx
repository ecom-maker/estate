import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { PropertyForm } from "@/components/admin/property-form";
import { RefreshNearbyButton } from "@/components/admin/refresh-nearby-button";
import { canEditProperty } from "@/lib/admin/property-access";
import { updateProperty } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Property" };

type Change = { field: string; from: string; to: string };

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let session;
  try {
    session = await assertPermission("properties.update");
  } catch {
    redirect(`/login?next=/admin/properties/${id}/edit`);
  }

  const [property, communities] = await Promise.all([
    prisma.property.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
    }),
    prisma.community.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!property) notFound();

  const editable = await canEditProperty(property.id, session);

  const history = await prisma.auditLog.findMany({
    where: {
      entityType: "property",
      entityId: property.id,
      action: "property_update",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });

  const meta = (property.metadata ?? {}) as {
    handoverDate?: string;
    dealType?: string;
  };

  // Projects (off-plan) and ready properties share this edit route; label it
  // to match the record so a project doesn't read as "Edit property".
  const isProject = property.offPlan;
  const kind = isProject ? "project" : "property";
  const detailHref = `/${isProject ? "projects" : "properties"}/${property.slug}`;
  const backHref = `/admin/properties?filter=${isProject ? "offplan" : "ready"}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link href={backHref} className="text-xs text-muted hover:text-primary">
        ← Back to {isProject ? "projects" : "properties"}
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · {isProject ? "Projects" : "Properties"}
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary capitalize">
        Edit {kind}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Updating{" "}
        <Link href={detailHref} className="text-accent hover:underline">
          {property.title}
        </Link>
        .
      </p>

      {editable ? (
        <PropertyForm
          action={updateProperty.bind(null, property.id)}
          communities={communities}
          property={{
            ...property,
            handoverDate: meta.handoverDate ?? null,
            dealType: meta.dealType ?? "sale",
          }}
          submitLabel="Save changes"
        />
      ) : (
        <div className="mt-6 rounded-sm border border-border bg-card p-6 text-sm text-muted">
          This listing was created by another admin, so it is read-only for
          you. Only its creator or a Super Admin can edit it.
        </div>
      )}

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-primary">Nearby data</h2>
        <p className="mt-1 text-sm text-muted">
          Schools, hospitals, metro and landmarks are cached in the database.
          Refresh to recompute them from the maps APIs (e.g. after moving the
          coordinates).
        </p>
        <div className="mt-3">
          <RefreshNearbyButton propertyId={property.id} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-primary">Edit history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No edits recorded yet. Changes made from here on are logged.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {history.map((h) => {
              const changes = ((h.meta as { changes?: Change[] } | null)
                ?.changes ?? []) as Change[];
              return (
                <li
                  key={h.id}
                  className="rounded-sm border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-medium text-primary">
                      {h.user?.name || h.user?.email || "Unknown"}
                    </span>
                    <span>{fmtDateTime(h.createdAt)}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium text-primary">
                          {c.field}:
                        </span>{" "}
                        <span className="text-muted line-through">{c.from}</span>{" "}
                        → <span className="text-primary">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
