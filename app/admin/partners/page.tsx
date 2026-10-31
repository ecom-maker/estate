import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/check";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { prisma } from "@/lib/db/prisma";
import { listPartnerKeys } from "@/lib/partners/keys";
import { PartnerKeyManager } from "./key-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner API" };

export default async function AdminPartnersPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;
  if (!isSuperAdmin(roles)) notFound();

  const [keys, pending, live] = await Promise.all([
    listPartnerKeys(),
    prisma.property
      .count({
        where: { source: { startsWith: "partner:" }, status: "DRAFT", deletedAt: null },
      })
      .catch(() => 0),
    prisma.property
      .count({
        where: { source: { startsWith: "partner:" }, status: "ACTIVE", deletedAt: null },
      })
      .catch(() => 0),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-28 md:px-10">
      <Link href="/admin" className="text-xs text-muted hover:text-primary">
        ← Back to admin
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Company Admin
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Partner API</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Issue API keys to partner companies so they can submit listings into the
        portal. Submissions arrive as <strong>DRAFT</strong> for review under{" "}
        <Link href="/admin/properties?filter=offplan" className="text-accent hover:underline">
          Properties
        </Link>
        . Full docs:{" "}
        <Link href="/api-docs/partners" className="text-accent hover:underline">
          {SITE_URL}/api-docs/partners
        </Link>
        .
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">
            Partner submissions pending review
          </p>
          <p className="mt-2 font-serif text-3xl text-primary">{pending}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">
            Partner listings live
          </p>
          <p className="mt-2 font-serif text-3xl text-primary">{live}</p>
        </div>
      </div>

      <h2 className="mt-12 font-serif text-2xl text-primary">API keys</h2>
      <p className="mt-1 text-sm text-muted">
        One key per partner company. Listings are attributed to the partner and
        can be revoked here.
      </p>
      <div className="mt-4">
        <PartnerKeyManager keys={keys} />
      </div>
    </div>
  );
}
