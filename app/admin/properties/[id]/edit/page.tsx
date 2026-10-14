import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { PropertyForm } from "@/components/admin/property-form";
import { RefreshNearbyButton } from "@/components/admin/refresh-nearby-button";
import { canEditProperty } from "@/lib/admin/property-access";
import { updateProperty, setUnitHidden, createUnit } from "../../actions";
import { AddUnitForm } from "@/components/admin/add-unit-form";
import { UnitFloorplanCell } from "@/components/admin/unit-floorplan-cell";
import { UnitTypeSelect } from "@/components/admin/unit-type-select";
import { UnitListingSelect } from "@/components/admin/unit-listing-select";
import { UnitSaveButton } from "@/components/admin/unit-save-button";

const UNIT_STATUSES = ["available", "reserved", "sold"];
const cellInput =
  "rounded-sm border border-border bg-card px-2 py-1 text-sm text-primary";

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

  const units = await prisma.propertyUnit.findMany({
    where: { propertyId: property.id },
    orderBy: [{ unitNumber: "asc" }],
    select: {
      id: true,
      unitNumber: true,
      floor: true,
      bedrooms: true,
      bathrooms: true,
      areaSqft: true,
      priceAed: true,
      view: true,
      status: true,
      hidden: true,
      unitType: true,
      metadata: true,
    },
  });

  // Each unit's own floor plan (stored under its unit number).
  const unitPlans = new Map(
    (
      await prisma.propertyFloorplan.findMany({
        where: { propertyId: property.id, unitRef: { in: units.map((u) => u.unitNumber) } },
        select: { unitRef: true, url: true },
      })
    ).map((f) => [f.unitRef, f.url]),
  );

  // Columns the feed rarely fills; shown only when some unit has a value.
  const showFloor = units.some((u) => u.floor != null);
  const showView = units.some((u) => u.view);

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
    forRent?: boolean;
  };

  // Projects (off-plan) and ready properties share this edit route; label it
  // to match the record so a project doesn't read as "Edit property".
  const isProject = property.offPlan;
  const kind = isProject ? "project" : "property";
  const detailHref = `/${isProject ? "projects" : "properties"}/${property.slug}`;
  const backHref = `/admin/properties?filter=${isProject ? "offplan" : "ready"}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-28 md:px-10">
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
            forRent: meta.forRent ?? false,
          }}
          submitLabel="Save changes"
          typePerUnit={units.length > 0}
        />
      ) : (
        <div className="mt-6 rounded-sm border border-border bg-card p-6 text-sm text-muted">
          This listing was created by another admin, so it is read-only for
          you. Only its creator or a Super Admin can edit it.
        </div>
      )}

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-primary">
          Units ({units.length})
        </h2>
        <p className="mt-1 text-sm text-muted">
          Individual units in this {kind}. Unit numbers are visible to admins
          only — never shown to the public or the AI assistant.
        </p>
        {units.length ? (
          <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Unit #</th>
                  <th>Type</th>
                  <th>Deal</th>
                  {showFloor ? <th>Floor</th> : null}
                  <th>Beds</th>
                  <th>Bath</th>
                  <th>Area (sqft)</th>
                  <th>Price (AED)</th>
                  <th>Rent/yr (AED)</th>
                  {showView ? <th>View</th> : null}
                  <th>Status</th>
                  <th>Floor plan</th>
                  <th className="px-4">Visibility</th>
                  {editable ? <th className="pr-4">Edit</th> : null}
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
                    <td className="pr-3">
                      {editable ? (
                        <UnitTypeSelect
                          id={u.id}
                          value={u.unitType}
                          projectType={property.type}
                        />
                      ) : (
                        <span className="capitalize">
                          {(u.unitType ?? property.type).toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="pr-3">
                      {editable ? (
                        <UnitListingSelect
                          id={u.id}
                          value={
                            (u.metadata as { listing?: string } | null)
                              ?.listing ?? "sale"
                          }
                        />
                      ) : (
                        <span className="capitalize">
                          {((u.metadata as { listing?: string } | null)
                            ?.listing ?? "sale") === "both"
                            ? "Sale & rent"
                            : (u.metadata as { listing?: string } | null)
                                  ?.listing === "rent"
                              ? "For rent"
                              : "For sale"}
                        </span>
                      )}
                    </td>
                    {showFloor ? <td>{u.floor ?? "—"}</td> : null}
                    <td>
                      {editable ? (
                        <input
                          form={`unit-${u.id}`}
                          name="bedrooms"
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          defaultValue={u.bedrooms ?? ""}
                          aria-label={`Beds for unit ${u.unitNumber}`}
                          className={`${cellInput} w-14`}
                        />
                      ) : (
                        (u.bedrooms ?? "—")
                      )}
                    </td>
                    <td>{u.bathrooms ?? "—"}</td>
                    <td>
                      {u.areaSqft
                        ? Math.round(u.areaSqft).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      {editable ? (
                        <input
                          form={`unit-${u.id}`}
                          name="priceAed"
                          inputMode="numeric"
                          defaultValue={u.priceAed ? Math.round(u.priceAed) : ""}
                          aria-label={`Price in AED for unit ${u.unitNumber}`}
                          className={`${cellInput} w-28`}
                        />
                      ) : u.priceAed ? (
                        Math.round(u.priceAed).toLocaleString()
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {(() => {
                        const rent = (
                          u.metadata as { rentPriceAed?: number } | null
                        )?.rentPriceAed;
                        return editable ? (
                          <input
                            form={`unit-${u.id}`}
                            name="rentPriceAed"
                            inputMode="numeric"
                            defaultValue={rent ? Math.round(rent) : ""}
                            placeholder="—"
                            aria-label={`Annual rent in AED for unit ${u.unitNumber}`}
                            className={`${cellInput} w-28`}
                          />
                        ) : rent ? (
                          Math.round(rent).toLocaleString()
                        ) : (
                          "—"
                        );
                      })()}
                    </td>
                    {showView ? <td>{u.view ?? "—"}</td> : null}
                    <td>
                      {editable ? (
                        <select
                          form={`unit-${u.id}`}
                          name="status"
                          defaultValue={(u.status ?? "").toLowerCase()}
                          aria-label={`Status for unit ${u.unitNumber}`}
                          className={cellInput}
                        >
                          <option value="">—</option>
                          {UNIT_STATUSES.map((st) => (
                            <option key={st} value={st} className="capitalize">
                              {st.charAt(0).toUpperCase() + st.slice(1)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (u.status ?? "—")
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {editable ? (
                        <UnitFloorplanCell id={u.id} url={unitPlans.get(u.unitNumber) ?? null} />
                      ) : unitPlans.get(u.unitNumber) ? (
                        <a
                          href={unitPlans.get(u.unitNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4">
                      <form action={setUnitHidden} className="inline">
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
                    </td>
                    {editable ? (
                      <td className="py-2 pr-4">
                        <UnitSaveButton id={u.id} formId={`unit-${u.id}`} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No units recorded for this {kind} yet.
          </p>
        )}
        {editable ? (
          <AddUnitForm
            action={createUnit.bind(null, property.id)}
            projectType={property.type}
          />
        ) : null}
      </section>

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
