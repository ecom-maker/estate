import { success } from "@/lib/api/response";
import { MockMLSAdapter } from "@/lib/connectors/mls/adapter";

export async function GET() {
  const adapter = new MockMLSAdapter();
  const rows = await adapter.fetchPage(1);
  return success({
    source: adapter.name,
    items: rows.map((row) => adapter.normalize(row)),
  });
}
