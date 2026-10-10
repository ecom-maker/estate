import Link from "next/link";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { listContacts } from "@/lib/admin/contacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Contacts" };

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminContactsPage() {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/contacts");
  }

  let contacts: Awaited<ReturnType<typeof listContacts>> = [];
  try {
    contacts = await listContacts();
  } catch {
    contacts = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Contacts
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Contacts</h1>
      <p className="mt-2 text-sm text-muted">
        {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} ·
        everyone who has chatted, enquired, or been saved as a lead. Open one to
        see their full history.
      </p>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Number</th>
              <th>Email</th>
              <th>Interactions</th>
              <th className="px-4">Last contact</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-accent/5">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/contacts/${c.id}`}
                    className="font-medium text-primary hover:text-accent"
                  >
                    {c.name || "Unknown"}
                  </Link>
                </td>
                <td>{c.phone || "—"}</td>
                <td className="max-w-[220px] truncate">{c.email || "—"}</td>
                <td>{c.interactionCount}</td>
                <td className="px-4 text-muted">{fmtDateTime(c.lastContactAt)}</td>
              </tr>
            ))}
            {contacts.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-4 py-6 text-muted">
                  No contacts yet. They appear once someone chats, enquires, or
                  is saved as a lead.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
