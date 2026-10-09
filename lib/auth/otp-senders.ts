/**
 * Delivery of one-time sign-in codes.
 *
 * WhatsApp uses the WhatsApp Business Cloud API with an approved
 * AUTHENTICATION template (Meta requires a template for business-initiated
 * messages). SMS uses Twilio. Each channel is available only when its
 * credentials are set, so the login page offers just the working ones.
 *
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_OTP_TEMPLATE (default "login_code"), WHATSAPP_OTP_TEMPLATE_LANG (default "en")
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

export type OtpChannel = "whatsapp" | "sms";

const env = (k: string) => process.env[k]?.trim() || "";

export function availableOtpChannels(): OtpChannel[] {
  const out: OtpChannel[] = [];
  if (env("WHATSAPP_ACCESS_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID")) out.push("whatsapp");
  if (env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM_NUMBER")) out.push("sms");
  return out;
}

/** Local development with no provider configured: fixed code, nothing sent. */
export function isMockOtp(): boolean {
  return process.env.NODE_ENV !== "production" && availableOtpChannels().length === 0;
}

export async function sendOtp(
  channel: OtpChannel,
  phoneE164: string,
  code: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    if (channel === "whatsapp") {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneE164.replace(/^\+/, ""),
            type: "template",
            template: {
              name: env("WHATSAPP_OTP_TEMPLATE") || "login_code",
              language: { code: env("WHATSAPP_OTP_TEMPLATE_LANG") || "en" },
              // Authentication templates take the code in the body and in the
              // copy-code button.
              components: [
                { type: "body", parameters: [{ type: "text", text: code }] },
                { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
              ],
            },
          }),
        },
      );
      if (!res.ok) return { sent: false, error: `WhatsApp ${res.status} ${await res.text().catch(() => "")}`.trim() };
      return { sent: true };
    }

    const sid = env("TWILIO_ACCOUNT_SID");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phoneE164,
        From: env("TWILIO_FROM_NUMBER"),
        Body: `${code} is your DM Global sign-in code. It expires in 10 minutes.`,
      }),
    });
    if (!res.ok) return { sent: false, error: `Twilio ${res.status} ${await res.text().catch(() => "")}`.trim() };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send failed" };
  }
}
