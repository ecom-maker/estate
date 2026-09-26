import Link from "next/link";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { ConnectorForm } from "@/components/admin/connector-form";
import { createConnector } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Connector" };

export default async function NewConnectorPage() {
  try {
    await assertPermission("connectors.manage");
  } catch {
    redirect("/login?next=/admin/api-connectors/new");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link
        href="/admin/api-connectors"
        className="text-xs text-muted hover:text-primary"
      >
        ← Back to connectors
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Connectors
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">New connector</h1>
      <p className="mt-2 text-sm text-muted">
        Point a data source (CRM, MLS, transactions, …) at its provider API.
        Change the base URL and key here whenever you switch providers.
      </p>

      <ConnectorForm action={createConnector} submitLabel="Create connector" />
    </div>
  );
}
