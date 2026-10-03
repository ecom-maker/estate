/**
 * Minimal transactional email via Resend's HTTP API (no SDK dependency).
 * Configure RESEND_API_KEY (and optionally EMAIL_FROM) to enable delivery.
 * Without a key it no-ops so callers still succeed.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "RESEND_API_KEY not configured" };

  // resend.dev is Resend's test sender (delivers to the account owner's email);
  // set EMAIL_FROM to a verified domain address for production sending.
  const from = process.env.EMAIL_FROM || "DM Global <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, error: `Resend ${res.status} ${detail}`.trim() };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "send failed",
    };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}
