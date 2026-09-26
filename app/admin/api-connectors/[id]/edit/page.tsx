import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { ConnectorForm } from "@/components/admin/connector-form";
import { updateConnector } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Connector" };

export default async function EditConnectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await assertPermission("connectors.manage");
  } catch {
    redirect(`/login?next=/admin/api-connectors/${id}/edit`);
  }

  const provider = await prisma.apiProvider.findUnique({
    where: { id },
    include: { credentials: { take: 1 } },
  });
  if (!provider) notFound();

  const authConfig = (provider.authConfig ?? {}) as {
    type?: string;
    headerName?: string;
  };

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
      <h1 className="mt-3 font-serif text-4xl text-primary">Edit connector</h1>
      <p className="mt-2 text-sm text-muted">Updating {provider.name}.</p>

      <ConnectorForm
        action={updateConnector.bind(null, provider.id)}
        connector={{
          name: provider.name,
          type: provider.type,
          baseUrl: provider.baseUrl,
          syncFrequency: provider.syncFrequency,
          priority: provider.priority,
          enabled: provider.enabled,
          authType: authConfig.type ?? "bearer",
          authHeaderName: authConfig.headerName ?? "",
          apiKeyConfigured: provider.credentials.length > 0,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
