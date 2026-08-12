import { success } from "@/lib/api/response";
import { MockTransactionAdapter } from "@/lib/connectors/transactions/adapter";

export async function GET() {
  const adapter = new MockTransactionAdapter();
  const rows = await adapter.fetchPage(1);
  return success({
    source: adapter.name,
    items: rows.map((row) => adapter.normalize(row)),
  });
}
