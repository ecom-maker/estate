import { redirect } from "next/navigation";
import { assertAuthenticated } from "@/lib/rbac/guards";
import { isAdmin } from "@/lib/rbac/check";
import { prisma } from "@/lib/db/prisma";
import { CreateAdminForm } from "@/components/admin/create-admin-form";
import { ADMIN_ROLE_NAMES } from "@/lib/admin/admin-roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin users" };

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const session = await assertAuthenticated().catch(() => null);
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  if (!session || !isAdmin(roles)) redirect("/login?next=/admin/users");
  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  let users: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: Date;
    roles: { role: { name: string } }[];
  }[] = [];
  try {
    users = await prisma.user.findMany({
      where: {
        roles: { some: { role: { name: { in: [...ADMIN_ROLE_NAMES] } } } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
  } catch {
    users = [];
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Admin contacts
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Admin users</h1>
      <p className="mt-2 text-sm text-muted">
        {users.length} admin {users.length === 1 ? "user" : "users"}. Admins can
        create and edit property listings.
      </p>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Roles</th>
              <th className="px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-primary">
                  {u.name || "—"}
                </td>
                <td>{u.email || "—"}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r.role.name}
                        className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                      >
                        {r.role.name.replace(/_/g, " ").toLowerCase()}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 text-muted">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-4 py-6 text-muted">
                  No admin users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isSuperAdmin ? (
        <div className="mt-8">
          <CreateAdminForm />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Only a Super Admin can create new admin users.
        </p>
      )}
    </div>
  );
}
