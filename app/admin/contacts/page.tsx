import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { listContacts } from "@/lib/admin/contacts";
import { ContactsTable } from "@/components/admin/contacts-table";

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

      <ContactsTable
        rows={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          interactionCount: c.interactionCount,
          lastContact: fmtDateTime(c.lastContactAt),
        }))}
      />
    </div>
  );
}
