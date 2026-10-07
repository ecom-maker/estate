import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { sendEmail, escapeHtml } from "@/lib/email/send";
import { success, failure } from "@/lib/api/response";
import { rateLimit } from "@/lib/security/rate-limit";
import type { Prisma } from "@prisma/client";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(5).max(60),
  comment: z.string().trim().min(2).max(4000),
});

// Resend's free tier (default test sender) only delivers to the account
// owner's address. Verify a domain + set EMAIL_FROM to send to any recipient,
// then point ENQUIRY_EMAIL wherever you like.
const ENQUIRY_EMAIL = process.env.ENQUIRY_EMAIL || "dmproperties2312@gmail.com";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limited = rateLimit(`enquiry:${ip}`, 5, 60_000);
  if (!limited.ok) {
    return failure(
      "RATE_LIMITED",
      "Too many submissions, try again shortly",
      429,
    );
  }

  try {
    const body = schema.parse(await request.json());

    // Store the enquiry (best-effort so a storage hiccup never blocks email).
    try {
      await prisma.auditLog.create({
        data: {
          action: "footer_enquiry",
          meta: {
            ...body,
            ip,
            submittedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // ignore storage errors
    }

    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;color:#111">
        <h2 style="margin:0 0 12px">New website enquiry</h2>
        <p style="margin:4px 0"><strong>Name:</strong> ${escapeHtml(body.name)}</p>
        <p style="margin:4px 0"><strong>Contact number:</strong> ${escapeHtml(body.contact)}</p>
        <p style="margin:12px 0 4px"><strong>Comment:</strong></p>
        <p style="margin:0;white-space:pre-wrap">${escapeHtml(body.comment)}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee" />
        <p style="margin:0;color:#666;font-size:12px">Submitted via DM Global footer · ${new Date().toUTCString()}</p>
      </div>`;

    const email = await sendEmail({
      to: ENQUIRY_EMAIL,
      subject: `New enquiry from ${body.name}`,
      html,
    });

    return success({ received: true, emailed: email.sent });
  } catch (error) {
    return failure(
      "ENQUIRY_ERROR",
      error instanceof Error ? error.message : "Submission failed",
      400,
    );
  }
}
