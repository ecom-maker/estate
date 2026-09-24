import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { PropertyForm } from "@/components/admin/property-form";
import { createProperty } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Property" };

export default async function NewPropertyPage() {
  try {
    await assertPermission("properties.create");
  } catch {
    redirect("/login?next=/admin/properties/new");
  }

  const communities = await prisma.community
    .findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    .catch(() => [] as { id: string; name: string }[]);

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
      <h1 className="mt-3 font-serif text-4xl text-primary">New property</h1>
      <p className="mt-2 text-sm text-muted">
        Create a listing manually. It will appear on the site once its status is
        set to Active.
      </p>

      <PropertyForm
        action={createProperty}
        communities={communities}
        submitLabel="Create property"
      />
    </div>
  );
}
