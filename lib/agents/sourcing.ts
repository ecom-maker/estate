import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { escapeHtml, sendEmail } from "@/lib/email/send";
import { phoneError } from "@/lib/validation/phone";
import { SITE_URL } from "@/lib/data-layer/canonical";
import type { AgentIdentity } from "@/lib/agents/crm";

/**
 * Off-market sourcing: when a personal agent's user wants something that isn't
 * listed on the portal, we offer to source it from the market. The agent sends
 * its user's contact details and requirements; we store them as a lead and
 * email the team.
 */

// Override with SOURCING_EMAIL. Note: Resend's default test sender only
// delivers to the Resend account owner's address until a domain is verified.
export const SOURCING_EMAIL = process.env.SOURCING_EMAIL || "prabhal2312@gmail.com";

/** The fields an agent should collect, as shown to it in replies and the card. */
export const SOURCING_FIELDS = {
  required: ["name", "phone or email", "at least one requirement (e.g. community, propertyType, bedrooms, budget)"],
  params: {
    name: "Buyer's full name",
    phone: "Phone with country code, e.g. +971 50 123 4567",
    email: "Email address",
    propertyType: "villa | apartment | penthouse | townhouse | land | ...",
    community: "Preferred area(s), e.g. Palm Jumeirah",
    bedrooms: "Bedrooms wanted, e.g. 4",
    minBudgetAed: "Minimum budget in AED",
    maxBudgetAed: "Maximum budget in AED",
    offPlan: "true = off-plan, false = ready",
    timeline: "When they want to buy or move, e.g. within 3 months",
    notes: "Anything else: view, floor, furnishing, payment plan...",
  },
} as const;

const optText = z.string().trim().max(300).optional();
const optNum = z
  .union([z.number(), z.string().trim().regex(/^\d+(\.\d+)?$/)])
  .transform(Number)
  .optional();

export const sourcingSchema = z
  .object({
    name: z.string().trim().min(2, "name is required").max(120),
    phone: z.string().trim().max(60).optional(),
    email: z.string().trim().max(200).email("email is not valid").optional(),
    propertyType: optText,
    community: optText,
    bedrooms: optNum,
    minBudgetAed: optNum,
    maxBudgetAed: optNum,
    offPlan: z.union([z.boolean(), z.enum(["true", "false"])]).transform((v) => v === true || v === "true").optional(),
    timeline: optText,
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) {
      ctx.addIssue({ code: "custom", message: "a phone number or an email is required" });
    }
    const pErr = v.phone ? phoneError(v.phone) : null;
    if (pErr) ctx.addIssue({ code: "custom", message: `phone: ${pErr}` });
    const hasRequirement = [v.propertyType, v.community, v.bedrooms, v.minBudgetAed, v.maxBudgetAed, v.notes].some(
      (x) => x !== undefined && x !== "",
    );
    if (!hasRequirement) {
      ctx.addIssue({
        code: "custom",
        message: "give at least one specific requirement (community, propertyType, bedrooms, budget or notes)",
      });
    }
  });

export type SourcingRequest = z.infer<typeof sourcingSchema>;

/** Readable "label: value" lines of what the buyer wants. */
export function requirementLines(r: SourcingRequest): string[] {
  const aed = (n: number) => `AED ${n.toLocaleString("en-US")}`;
  const budget =
    r.minBudgetAed && r.maxBudgetAed
      ? `${aed(r.minBudgetAed)} – ${aed(r.maxBudgetAed)}`
      : r.maxBudgetAed
        ? `up to ${aed(r.maxBudgetAed)}`
        : r.minBudgetAed
          ? `from ${aed(r.minBudgetAed)}`
          : null;
  return [
    r.propertyType && `Property type: ${r.propertyType}`,
    r.community && `Area: ${r.community}`,
    r.bedrooms !== undefined && `Bedrooms: ${r.bedrooms === 0 ? "Studio" : r.bedrooms}`,
    budget && `Budget: ${budget}`,
    r.offPlan !== undefined && `Status: ${r.offPlan ? "Off-plan" : "Ready"}`,
    r.timeline && `Timeline: ${r.timeline}`,
    r.notes && `Notes: ${r.notes}`,
  ].filter((x): x is string => typeof x === "string");
}

export async function createSourcingRequest(
  r: SourcingRequest,
  who: AgentIdentity,
): Promise<{ reference: string; emailed: boolean }> {
  const lead = await prisma.lead.create({
    data: {
      kind: "sourcing_request",
      channel: "a2a",
      name: r.name,
      phone: r.phone ? r.phone.replace(/[^\d+]/g, "").replace(/^\+/, "") : null,
      email: r.email ?? null,
      requirements: {
        propertyType: r.propertyType ?? null,
        community: r.community ?? null,
        bedrooms: r.bedrooms ?? null,
        minBudgetAed: r.minBudgetAed ?? null,
        maxBudgetAed: r.maxBudgetAed ?? null,
        offPlan: r.offPlan ?? null,
        timeline: r.timeline ?? null,
      },
      notes: [
        r.notes,
        `Via AI agent ${who.name ? `${who.name} (${who.agentId})` : who.agentId}${who.owner ? ` for ${who.owner}` : ""}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });
  const reference = lead.id.slice(-6).toUpperCase();

  const row = (label: string, value: string | null | undefined) =>
    value ? `<p style="margin:4px 0"><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;color:#111">
      <h2 style="margin:0 0 12px">Property sourcing request (Ref ${reference})</h2>
      <p style="margin:0 0 12px;color:#444">A buyer's AI agent asked for a property that isn't listed on ${escapeHtml(SITE_URL)}. Source it from the market and contact them.</p>
      ${row("Name", r.name)}
      ${row("Phone", r.phone)}
      ${row("Email", r.email)}
      <p style="margin:12px 0 4px"><strong>Requirements:</strong></p>
      <ul style="margin:0;padding-left:18px">${requirementLines(r).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee" />
      <p style="margin:0;color:#666;font-size:12px">
        Agent: ${escapeHtml(who.name ?? who.agentId)}${who.owner ? ` · acting for ${escapeHtml(who.owner)}` : ""} ·
        ${new Date().toUTCString()} · also saved in Admin → Leads
      </p>
    </div>`;

  const email = await sendEmail({
    to: SOURCING_EMAIL,
    subject: `Sourcing request: ${requirementLines(r)[0] ?? "property"} — ${r.name}`,
    html,
    replyTo: r.email,
  });
  if (!email.sent) console.warn("[sourcing] email not sent:", email.error);
  return { reference, emailed: email.sent };
}
