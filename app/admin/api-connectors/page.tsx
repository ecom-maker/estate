import { MockCRMAdapter } from "@/lib/connectors/crm/adapter";
import { MockMLSAdapter } from "@/lib/connectors/mls/adapter";
import { MockTransactionAdapter } from "@/lib/connectors/transactions/adapter";

export const metadata = { title: "API Connectors" };

export default function AdminConnectorsPage() {
  const connectors = [
    new MockCRMAdapter(),
    new MockMLSAdapter(),
    new MockTransactionAdapter(),
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Connectors
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">API Connectors</h1>
      <p className="mt-2 text-sm text-muted">
        Generic connector framework with encrypted credentials and mock adapters.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {connectors.map((connector) => (
          <article
            key={connector.name}
            className="rounded-sm border border-border bg-card p-5"
          >
            <p className="text-xs uppercase tracking-wider text-muted">
              {connector.type}
            </p>
            <h2 className="mt-2 font-serif text-xl text-primary">
              {connector.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Health: mock · Sync via{" "}
              <code className="text-primary">POST /api/sync</code>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
