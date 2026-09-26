import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { PropertyForm } from "@/components/admin/property-form";
import { updateProperty } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Property" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await assertPermission("properties.update");
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

  const meta = (property.metadata ?? {}) as { handoverDate?: string };

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link
        href="/admin/properties"
        className="text-xs text-muted hover:text-primary"
      >
        ← Back to properties
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Properties
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Edit property</h1>
      <p className="mt-2 text-sm text-muted">
        Updating{" "}
        <Link
          href={`/properties/${property.slug}`}
          className="text-accent hover:underline"
        >
          {property.title}
        </Link>
        .
      </p>

      <PropertyForm
        action={updateProperty.bind(null, property.id)}
        communities={communities}
        property={{ ...property, handoverDate: meta.handoverDate ?? null }}
        submitLabel="Save changes"
      />
    </div>
  );
}
