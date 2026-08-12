import { failure, success } from "@/lib/api/response";
import { runMockSync } from "@/lib/sync/engine";
import { z } from "zod";

const schema = z.object({
  source: z.enum(["crm", "mls", "transactions"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await runMockSync(body.source);
    return success(result);
  } catch (error) {
    return failure(
      "SYNC_ERROR",
      error instanceof Error ? error.message : "Sync failed",
      400,
    );
  }
}
