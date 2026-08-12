import { success } from "@/lib/api/response";
import { MockCRMAdapter } from "@/lib/connectors/crm/adapter";

export async function GET() {
  const adapter = new MockCRMAdapter();
  const rows = await adapter.fetchPage(1);
  return success({
    source: adapter.name,
    items: rows.map((row) => adapter.normalize(row)),
  });
}
