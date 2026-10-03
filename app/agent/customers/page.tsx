import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

// Roles permitted to view the customer list (it contains other users' PII).
const ALLOWED = ["AGENT", "COMPANY_ADMIN", "SUPER_ADMIN"];

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?error=AccessDenied");
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.some((r) => ALLOWED.includes(r))) redirect("/agent");

  const customers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      roles: { some: { role: { name: "CUSTOMER" } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { favorites: true, savedSearches: true } },
    },
    take: 200,
  });

  return (
    <AgentShell
      title="Customers"
      subtitle={`${customers.length} registered ${customers.length === 1 ? "customer" : "customers"}.`}
    >
      {customers.length === 0 ? (
        <EmptyState>No customers have signed up yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Favorites</th>
                <th className="px-4 py-3 font-medium">Saved</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id} className="bg-background">
                  <td className="px-4 py-3 text-primary">{c.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c._count.favorites}</td>
                  <td className="px-4 py-3 text-muted">{c._count.savedSearches}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AgentShell>
  );
}
