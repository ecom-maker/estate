import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendEmail, escapeHtml } from "@/lib/email/send";

/**
 * Emails the transcript of every chat session that has gone quiet, so the team
 * gets each completed conversation — new contacts and existing ones alike.
 *
 * A session is "complete" once its last message is older than IDLE_MINUTES.
 * Each quiet burst is emailed once; a later burst on the same session fires
 * again. Progress is tracked in audit_logs so nothing is sent twice or missed.
 *
 * Driven by chat activity (called from the chat route after a reply) and also
 * reachable via the /api/cron/chat-digest endpoint for a manual/external flush.
 */
const IDLE_MINUTES = 10;
const LOOKBACK_DAYS = 7;
const MAX_SESSIONS = 50;

const RECIPIENT =
  process.env.CHAT_DIGEST_EMAIL ||
  process.env.SELL_LEADS_EMAIL ||
  process.env.ENQUIRY_EMAIL ||
  "prabhal2312@gmail.com";

// Per-instance throttle so high chat traffic doesn't sweep on every message.
let lastSweep = 0;

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

function contactName(s: SessionWithMessages): string {
  if (s.channel === "whatsapp") return s.phone ? `+${s.phone}` : "WhatsApp user";
  return s.user?.name || s.user?.email || "Website visitor";
}

function transcriptHtml(
  s: SessionWithMessages,
  msgs: SessionWithMessages["messages"],
) {
  const who = contactName(s);
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
      <h2 style="margin:0 0 4px">New conversation — ${escapeHtml(who)}</h2>
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

/**
 * Sweep idle sessions and email any completed burst not yet sent.
 * @param throttleMs skip if a sweep ran within this window (0 = always run).
 */
export async function runChatDigest(
  throttleMs = 0,
): Promise<{ checked: number; sent: number; skipped?: boolean }> {
  const now = Date.now();
  if (throttleMs > 0 && now - lastSweep < throttleMs) {
    return { checked: 0, sent: 0, skipped: true };
  }
  lastSweep = now;

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
    const marker = await prisma.auditLog.findFirst({
      where: { action: "chat_digest_sent", entityId: s.id },
      orderBy: { createdAt: "desc" },
      select: { meta: true },
    });
    const digestedAt = (marker?.meta as { digestedAt?: string } | null)
      ?.digestedAt;
    const lastDigested = digestedAt ? new Date(digestedAt) : null;

    if (lastDigested && s.updatedAt <= lastDigested) continue;

    const msgs = lastDigested
      ? s.messages.filter((m) => m.createdAt > lastDigested)
      : s.messages;
    if (!msgs.length) continue;

    const res = await sendEmail({
      to: RECIPIENT,
      subject: `Chat transcript — ${contactName(s)} (${s.channel}, ${msgs.length} msg)`,
      html: transcriptHtml(s, msgs),
    });

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
