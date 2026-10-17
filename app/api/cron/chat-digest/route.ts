import { runChatDigest } from "@/lib/chat/digest";
import { success, failure } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * Manual / external flush of the chat-transcript digest. Day to day this runs
 * automatically off chat activity (see lib/chat/digest.ts, called from the chat
 * route); this endpoint lets you force a sweep — useful for the tail session in
 * a quiet period. Secured by CRON_SECRET (Authorization: Bearer … or ?secret=).
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return failure("NOT_CONFIGURED", "CRON_SECRET is not set", 503);
  }
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const ok =
    auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
  if (!ok) return failure("UNAUTHORIZED", "Invalid cron secret", 401);

  try {
    return success(await runChatDigest());
  } catch (error) {
    return failure(
      "DIGEST_ERROR",
      error instanceof Error ? error.message : "failed",
      500,
    );
  }
}

export const GET = handle;
export const POST = handle;
