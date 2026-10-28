import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/check";
import { type DeveloperRowData } from "./developer-row";
import { DevelopersList } from "./developers-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developers" };

export default async function AdminDevelopersPage() {
  // Super-admins only. Other staff admins get a 404 rather than the page.
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
  if (!isSuperAdmin(roles)) notFound();

  let developers: DeveloperRowData[] = [];
  // The contact/NOC columns ship in a migration (20261027120000_developer_contact).
  // Until it's applied, selecting them throws — fall back to names only and warn.
  let migrationPending = false;

  try {
    const rows = await prisma.developer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        nocUrl: true,
        _count: { select: { properties: true } },
      },
    });
    developers = rows.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      nocUrl: d.nocUrl,
      propertyCount: d._count.properties,
    }));
  } catch {
    migrationPending = true;
    try {
      const rows = await prisma.developer.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { properties: true } } },
      });
      developers = rows.map((d) => ({
        id: d.id,
        name: d.name,
        email: null,
        phone: null,
        nocUrl: null,
        propertyCount: d._count.properties,
      }));
    } catch {
      developers = [];
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-28 md:px-10">
      <Link href="/admin" className="text-xs text-muted hover:text-primary">
        ← Back to admin
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Company Admin
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Developers</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Developer contacts and documents. Add an email, contact number and NOC
        for each developer.
      </p>

      {migrationPending ? (
        <p className="mt-6 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The contact and NOC fields need a database migration
          (<code>20261027120000_developer_contact</code>). Run{" "}
          <code>prisma migrate deploy</code> against the production database;
          until then only developer names are shown and saving is disabled.
        </p>
      ) : null}

      {developers.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No developers yet.</p>
      ) : (
        <DevelopersList developers={developers} />
      )}
    </div>
  );
}
