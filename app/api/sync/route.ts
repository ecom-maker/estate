import { failure, success } from "@/lib/api/response";
import { runMockSync } from "@/lib/sync/engine";
import { assertPermission } from "@/lib/rbac/guards";
import { z } from "zod";

const schema = z.object({
  source: z.enum(["crm", "mls", "transactions"]),
});

export async function POST(request: Request) {
  // This route upserts rows into `properties`, so it must not be open to the
  // public — an unauthenticated caller could write listings into the live
  // database. Same guard the admin property screens use.
  try {
    await assertPermission("properties.create");
  } catch (error) {
    const message = error instanceof Error ? error.message : "FORBIDDEN";
    return message === "UNAUTHORIZED"
      ? failure("UNAUTHORIZED", "Sign in to run a sync", 401)
      : failure("FORBIDDEN", "You do not have permission to run a sync", 403);
  }

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
