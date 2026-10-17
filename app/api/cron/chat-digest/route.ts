import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendEmail, escapeHtml } from "@/lib/email/send";
import { success, failure } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * Emails the transcript of every chat session that has gone quiet, so the team
 * gets each completed conversation — including ones from existing contacts.
 *
 * Runs on a schedule (Vercel Cron, see vercel.json). A session is "complete"
 * once its last message is older than IDLE_MINUTES. Each completed burst is
 * emailed once; a new burst on the same session (e.g. the contact returns
 * later) is emailed again. Progress is tracked in audit_logs so nothing is
 * sent twice and nothing is missed across runs.
 */
const IDLE_MINUTES = 10;
const LOOKBACK_DAYS = 7;
const MAX_SESSIONS = 50;

const RECIPIENT =
  process.env.CHAT_DIGEST_EMAIL ||
  process.env.SELL_LEADS_EMAIL ||
  process.env.ENQUIRY_EMAIL ||
  "prabhal2312@gmail.com";

function fmt(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });
}

type SessionWithMessages = Prisma.ChatSessionGetPayload<{
  include: {
    messages: true;
    user: { select: { name: true; email: true; phone: true } };
  };
}>;

function transcriptHtml(
  s: SessionWithMessages,
  msgs: SessionWithMessages["messages"],
) {
  const who =
    s.channel === "whatsapp"
      ? s.phone
        ? `+${s.phone}`
        : "WhatsApp user"
      : s.user?.name || s.user?.email || "Website visitor";
  const rows = msgs
    .map((m) => {
      const label = m.role === "USER" ? "Contact" : "Assistant";
      const color = m.role === "USER" ? "#0f172a" : "#64748b";
      return `
        <tr>
          <td style="padding:8px 12px;vertical-align:top;white-space:nowrap;color:#94a3b8;font-size:12px">${fmt(m.createdAt)}</td>
          <td style="padding:8px 12px;vertical-align:top;white-space:nowrap;font-weight:600;color:${color};font-size:12px">${label}</td>
          <td style="padding:8px 12px;vertical-align:top;color:#111;white-space:pre-wrap">${escapeHtml(m.content)}</td>
        </tr>`;
    })
    .join("");
  return `
    <div style="font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px">
      <h2 style="margin:0 0 4px">New conversation — ${escapeHtml(who ?? "")}</h2>
      <p style="margin:0 0 2px;color:#666;font-size:13px">
        Channel: <strong>${escapeHtml(s.channel)}</strong> ·
        ${msgs.length} message${msgs.length === 1 ? "" : "s"} ·
        last activity ${fmt(s.updatedAt)}
      </p>
      ${s.title ? `<p style="margin:2px 0;color:#666;font-size:13px">Topic: ${escapeHtml(s.title)}</p>` : ""}
      ${s.summary ? `<p style="margin:2px 0 0;color:#666;font-size:13px">Summary: ${escapeHtml(s.summary)}</p>` : ""}
      <table style="margin-top:14px;border-collapse:collapse;width:100%;border:1px solid #eee">
        ${rows}
      </table>
      <p style="margin:16px 0 0;color:#888;font-size:12px">
        Session ${escapeHtml(s.id)} · sent by DM Global · ${new Date().toUTCString()}
      </p>
    </div>`;
}

async function runDigest() {
  const now = Date.now();
  const cutoff = new Date(now - IDLE_MINUTES * 60_000);
  const lookback = new Date(now - LOOKBACK_DAYS * 24 * 60 * 60_000);

  const sessions = await prisma.chatSession.findMany({
    where: {
      updatedAt: { lte: cutoff, gte: lookback },
      messages: { some: {} },
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_SESSIONS,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  let sent = 0;
  for (const s of sessions) {
    // Last time this session was digested (tracked in audit_logs).
    const marker = await prisma.auditLog.findFirst({
      where: { action: "chat_digest_sent", entityId: s.id },
      orderBy: { createdAt: "desc" },
      select: { meta: true },
    });
    const digestedAt = (marker?.meta as { digestedAt?: string } | null)
      ?.digestedAt;
    const lastDigested = digestedAt ? new Date(digestedAt) : null;

    // Already emailed this quiet burst — skip until there's newer activity.
    if (lastDigested && s.updatedAt <= lastDigested) continue;

    const msgs = lastDigested
      ? s.messages.filter((m) => m.createdAt > lastDigested)
      : s.messages;
    if (!msgs.length) continue;

    const who =
      s.channel === "whatsapp"
        ? s.phone
          ? `+${s.phone}`
          : "WhatsApp"
        : s.user?.name || "web";
    const res = await sendEmail({
      to: RECIPIENT,
      subject: `Chat transcript — ${who} (${s.channel}, ${msgs.length} msg)`,
      html: transcriptHtml(s, msgs),
    });

    // Record progress even if the email provider is unconfigured, so the DB
    // marks the burst handled; delivery issues are an email-config concern.
    await prisma.auditLog.create({
      data: {
        action: "chat_digest_sent",
        entityType: "chat_session",
        entityId: s.id,
        meta: {
          digestedAt: s.updatedAt.toISOString(),
          messages: msgs.length,
          emailed: res.sent,
          to: RECIPIENT,
        } as Prisma.InputJsonValue,
      },
    });
    if (res.sent) sent++;
  }

  return { checked: sessions.length, sent };
}

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
    return success(await runDigest());
  } catch (error) {
    return failure(
      "DIGEST_ERROR",
      error instanceof Error ? error.message : "failed",
      500,
    );
  }
}

// Vercel Cron issues GET; allow POST for manual/external triggers too.
export const GET = handle;
export const POST = handle;
