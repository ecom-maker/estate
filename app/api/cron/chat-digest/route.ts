import { runChatDigest } from "@/lib/chat/digest";
import { success, failure } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * Manual / external flush of the chat-transcript digest. Day to day this runs
 * automatically off chat activity (see lib/chat/digest.ts, called from the chat
 * route); this endpoint lets you force a sweep — useful for the tail session in
 * a quiet period. Secured by CRON_SECRET (Authorization: Bearer … or ?secret=).
 */
// Temporary deploy/env diagnostic. Bump BUILD_MARKER each deploy to confirm the
// new build is live; `?diag=1` reports which env vars the runtime can see
// (presence only — never the values). Remove once email delivery is confirmed.
const BUILD_MARKER = "diag-3";

async function handle(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("diag") === "1") {
    return success({
      build: BUILD_MARKER,
      hasCronSecret: Boolean(process.env.CRON_SECRET?.trim()),
      hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
      emailFrom: process.env.EMAIL_FROM ? "set" : "default(resend.dev)",
      digestRecipient:
        process.env.CHAT_DIGEST_EMAIL ||
        process.env.SELL_LEADS_EMAIL ||
        process.env.ENQUIRY_EMAIL ||
        "prabhal2312@gmail.com",
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return failure("NOT_CONFIGURED", "CRON_SECRET is not set", 503);
  }
  const auth = request.headers.get("authorization");
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
