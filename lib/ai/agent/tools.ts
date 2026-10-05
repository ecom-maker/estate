import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { AgentChannel } from "./prompt";
import {
  areaOverview,
  availability,
  developerInfo,
  findAnyProperty,
  loadInventory,
  propertyDetails,
  searchInventory,
  type AgentProperty,
  type SearchCriteria,
} from "./inventory";

/** The business WhatsApp line a human specialist answers. */
export function whatsappNumber() {
  return (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "16509105069").replace(/\D/g, "");
}

// ------------------------------------------------------------- definitions

const requirementsSchema = {
  type: "object",
  description: "Everything learned in discovery, so the specialist never re-asks.",
  properties: {
    purpose: { type: "string", description: "live in / investment / rental income / holiday home / other" },
    locations: { type: "array", items: { type: "string" } },
    propertyTypes: { type: "array", items: { type: "string" } },
    bedrooms: { type: "string" },
    budgetMinAed: { type: "number" },
    budgetMaxAed: { type: "number" },
    readyOrOffPlan: { type: "string" },
    timeline: { type: "string" },
    financing: { type: "string", description: "cash / mortgage / undecided" },
    mustHaves: { type: "string" },
    dealBreakers: { type: "string" },
    decisionMakers: { type: "string" },
    objections: { type: "string" },
    propertiesDiscussed: { type: "array", items: { type: "string" } },
  },
};

const contactProps = {
  name: { type: "string" },
  phone: { type: "string", description: "With country code if given." },
  email: { type: "string" },
};

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description:
        "Search the live inventory. Use once the requirement is clear enough or the person names an area/type/budget. Returns up to `limit` matches with reasons, or labelled alternatives when nothing fits.",
      parameters: {
        type: "object",
        properties: {
          locations: { type: "array", items: { type: "string" }, description: "Areas/communities/emirates, any-of, e.g. [\"Dubai Marina\",\"JBR\"] or [\"Abu Dhabi\"]. Omit for anywhere." },
          developer: { type: "string" },
          propertyTypes: { type: "array", items: { type: "string", enum: ["apartment", "villa", "townhouse", "penthouse", "duplex", "land"] } },
          bedrooms: { type: "array", items: { type: "integer" }, description: "Exact bedroom counts, any-of. Studio = 0." },
          minBedrooms: { type: "integer", description: "For '3+ bedrooms'." },
          minPriceAed: { type: "number" },
          maxPriceAed: { type: "number", description: "Budget ceiling in AED (3M = 3000000)." },
          minSizeSqft: { type: "number" },
          maxSizeSqft: { type: "number" },
          completion: { type: "string", enum: ["ready", "off_plan", "any"] },
          handoverByYear: { type: "integer", description: "Only projects handing over by this year (ready ones included)." },
          dealType: { type: "string", enum: ["sale", "rent"] },
          postHandoverPlan: { type: "boolean", description: "Only projects with a post-handover payment plan." },
          furnished: { type: "boolean" },
          waterfront: { type: "boolean" },
          amenities: { type: "array", items: { type: "string" } },
          keywords: { type: "string" },
          sort: { type: "string", enum: ["best_match", "price_low_to_high", "price_high_to_low", "handover_soonest"] },
          limit: { type: "integer", description: "Default 4, max 8." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property",
      description: "Full verified facts for one property or project: unit types with prices and sizes, payment plans, handover, construction progress, service charge, amenities, documents.",
      parameters: {
        type: "object",
        properties: { property: { type: "string", description: "Property id, slug or name." } },
        required: ["property"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Current availability for a property, optionally for one bedroom count or unit type.",
      parameters: {
        type: "object",
        properties: {
          property: { type: "string", description: "Property id, slug or name." },
          bedrooms: { type: "integer" },
          unit: { type: "string", description: "Unit or unit-type reference, e.g. \"2BR\"." },
        },
        required: ["property"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_developer",
      description: "A developer's details and its projects in the inventory.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_areas",
      description: "Which areas/emirates and developers currently have inventory, with counts and from-prices. Use for 'where do you have projects?' or to suggest other areas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "request_brochure",
      description: "Get the brochure and floor-plan links on file for a property, to share in the chat.",
      parameters: {
        type: "object",
        properties: { property: { type: "string" }, ...contactProps },
        required: ["property"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_viewing",
      description: "Record a viewing request for a specialist to confirm. Needs the property, a preferred date, the person's name and a phone or email.",
      parameters: {
        type: "object",
        properties: {
          property: { type: "string" },
          preferredDate: { type: "string", description: "YYYY-MM-DD" },
          preferredTime: { type: "string", description: "e.g. \"11:00\" or \"afternoon\"" },
          ...contactProps,
          notes: { type: "string" },
          requirements: requirementsSchema,
        },
        required: ["property", "preferredDate", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_lead",
      description: "Save contact details + requirements for follow-up: a specialist call, a callback at a time, a brochure to be sent, or a general enquiry.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["contact_request", "callback", "brochure", "enquiry"] },
          ...contactProps,
          property: { type: "string", description: "Property the lead is about, if any." },
          preferredDate: { type: "string", description: "For callbacks: YYYY-MM-DD" },
          preferredTime: { type: "string" },
          notes: { type: "string" },
          requirements: requirementsSchema,
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description: "Hand the conversation to a human specialist. Call IMMEDIATELY when the person asks for a human/agent/real person.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          summary: { type: "string", description: "One-paragraph summary of what the person wants so far." },
          ...contactProps,
          property: { type: "string" },
          requirements: requirementsSchema,
        },
        required: ["reason"],
      },
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]["function"]["name"];

// ------------------------------------------------------------- execution

export type ToolContext = {
  channel: AgentChannel;
  sessionId: string;
  /** WhatsApp sender, digits only. */
  phone?: string | null;
  /** Collected per turn: ids to show in the website's results grid. */
  shownPropertyIds?: string[];
  lastSearch?: SearchCriteria;
  leadIds?: string[];
  /** Loaded once per turn and shared by every tool call in it. */
  inventory?: Promise<AgentProperty[]>;
};

const inventoryOf = (ctx: ToolContext) => (ctx.inventory ??= loadInventory());

const str = z.string().trim().min(1).max(500);
const contact = {
  name: str.optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
};
const requirements = z.record(z.string(), z.unknown()).optional();

const searchArgs = z.object({
  locations: z.array(str).optional(),
  developer: str.optional(),
  propertyTypes: z.array(str).optional(),
  bedrooms: z.array(z.number().int().min(0).max(20)).optional(),
  minBedrooms: z.number().int().min(0).max(20).optional(),
  minPriceAed: z.number().nonnegative().optional(),
  maxPriceAed: z.number().positive().optional(),
  minSizeSqft: z.number().nonnegative().optional(),
  maxSizeSqft: z.number().positive().optional(),
  completion: z.enum(["ready", "off_plan", "any"]).optional(),
  handoverByYear: z.number().int().min(2000).max(2100).optional(),
  dealType: z.enum(["sale", "rent"]).optional(),
  postHandoverPlan: z.boolean().optional(),
  furnished: z.boolean().optional(),
  waterfront: z.boolean().optional(),
  amenities: z.array(str).optional(),
  keywords: str.optional(),
  sort: z.enum(["best_match", "price_low_to_high", "price_high_to_low", "handover_soonest"]).optional(),
  limit: z.number().int().min(1).max(8).optional(),
});

/** Resolve a property reference to exactly one row, or explain why not. */
async function oneProperty(ctx: ToolContext, ref: string): Promise<AgentProperty | { error: string; candidates?: string[] }> {
  const hits = await findAnyProperty(await inventoryOf(ctx), ref);
  if (hits.length === 1) return hits[0];
  if (!hits.length) return { error: `No property called "${ref}" in the inventory.` };
  return { error: `"${ref}" matches several properties — ask which one.`, candidates: hits.slice(0, 6).map((p) => p.title) };
}

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const validEmail = (s?: string) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Write (or refresh) a lead. One row per session + kind + property, so the
 * model calling the tool twice, or the person correcting a detail, updates
 * the same lead instead of creating duplicates.
 */
async function upsertLead(
  ctx: ToolContext,
  kind: string,
  data: {
    propertyId?: string | null;
    name?: string;
    phone?: string;
    email?: string;
    preferredDate?: string;
    preferredTime?: string;
    notes?: string;
    requirements?: Record<string, unknown>;
  },
) {
  const phone = digits(data.phone) || (ctx.channel === "whatsapp" ? digits(ctx.phone) : "") || null;
  const fields = {
    kind,
    channel: ctx.channel,
    sessionId: ctx.sessionId,
    propertyId: data.propertyId ?? null,
    name: data.name ?? null,
    phone,
    email: validEmail(data.email) ? data.email! : null,
    preferredDate: data.preferredDate ?? null,
    preferredTime: data.preferredTime ?? null,
    notes: data.notes ?? null,
    requirements: (data.requirements ?? undefined) as never,
  };
  const existing = await prisma.lead.findFirst({
    where: { sessionId: ctx.sessionId, kind, propertyId: fields.propertyId },
  });
  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        // Keep earlier details the model did not repeat this time.
        data: Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null)),
      })
    : await prisma.lead.create({ data: fields });
  ctx.leadIds = [...new Set([...(ctx.leadIds ?? []), lead.id])];
  return lead;
}

function needContact(ctx: ToolContext, a: { phone?: string; email?: string }) {
  if (ctx.channel === "whatsapp" && digits(ctx.phone)) return null;
  if (digits(a.phone).length >= 7 || validEmail(a.email)) return null;
  return "A phone number (with country code) or an email is needed — ask the person for it, then call again.";
}

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<unknown> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  switch (name) {
    case "search_properties": {
      const c = searchArgs.parse(args);
      const { result, shownIds } = searchInventory(await inventoryOf(ctx), c);
      ctx.shownPropertyIds = shownIds;
      ctx.lastSearch = c;
      return result;
    }
    case "get_property": {
      const p = await oneProperty(ctx, z.object({ property: str }).parse(args).property);
      return "error" in p ? p : propertyDetails(p);
    }
    case "check_availability": {
      const a = z.object({ property: str, bedrooms: z.number().int().optional(), unit: str.optional() }).parse(args);
      const p = await oneProperty(ctx, a.property);
      return "error" in p ? p : availability(p, a);
    }
    case "get_developer":
      return developerInfo(z.object({ name: str }).parse(args).name);
    case "list_areas":
      return areaOverview(await inventoryOf(ctx));
    case "request_brochure": {
      const a = z.object({ property: str, ...contact }).parse(args);
      const p = await oneProperty(ctx, a.property);
      if ("error" in p) return p;
      const docs = p.documents.map((d) => ({ title: d.title, kind: d.kind, url: d.url }));
      if (a.phone || a.email) await upsertLead(ctx, "brochure", { ...a, propertyId: p.id });
      return docs.length
        ? { property: p.title, documents: docs, note: "Share these links in the chat. Nothing has been emailed." }
        : { property: p.title, documents: [], note: "No brochure on file. Offer to have a specialist send details (save_lead kind 'brochure')." };
    }
    case "book_viewing": {
      const a = z
        .object({ property: str, preferredDate: str, preferredTime: str.optional(), notes: z.string().max(2000).optional(), requirements, ...contact })
        .parse(args);
      const missing = needContact(ctx, a);
      if (missing) return { success: false, error: missing };
      const p = await oneProperty(ctx, a.property);
      if ("error" in p) return { success: false, ...p };
      const lead = await upsertLead(ctx, "viewing", { ...a, propertyId: p.id, requirements: a.requirements });
      return {
        success: true,
        reference: lead.id.slice(-6).toUpperCase(),
        property: p.title,
        requested: `${a.preferredDate}${a.preferredTime ? ` ${a.preferredTime}` : ""}`,
        status: "REQUESTED — a property specialist will contact the person to confirm the slot. Do not call it confirmed.",
      };
    }
    case "save_lead": {
      const a = z
        .object({
          kind: z.enum(["contact_request", "callback", "brochure", "enquiry"]),
          property: str.optional(),
          preferredDate: str.optional(),
          preferredTime: str.optional(),
          notes: z.string().max(2000).optional(),
          requirements,
          ...contact,
        })
        .parse(args);
      const missing = needContact(ctx, a);
      if (missing) return { success: false, error: missing };
      let propertyId: string | null = null;
      if (a.property) {
        const p = await oneProperty(ctx, a.property);
        if (!("error" in p)) propertyId = p.id;
      }
      const lead = await upsertLead(ctx, a.kind, { ...a, propertyId });
      return {
        success: true,
        reference: lead.id.slice(-6).toUpperCase(),
        status: "Saved. A property specialist will follow up. Do not promise a specific response time.",
      };
    }
    case "transfer_to_human": {
      const a = z
        .object({ reason: z.string().max(500), summary: z.string().max(2000).optional(), property: str.optional(), requirements, ...contact })
        .parse(args);
      let propertyId: string | null = null;
      let propertyName: string | null = null;
      if (a.property) {
        const p = await oneProperty(ctx, a.property);
        if (!("error" in p)) {
          propertyId = p.id;
          propertyName = p.title;
        }
      }
      const lead = await upsertLead(ctx, "human_handoff", {
        ...a,
        propertyId,
        notes: [a.reason, a.summary].filter(Boolean).join("\n\n"),
      });
      const text = `Hi, I'd like to speak with a property specialist${propertyName ? ` about ${propertyName}` : ""}. (Ref ${lead.id.slice(-6).toUpperCase()})`;
      return ctx.channel === "whatsapp"
        ? {
            success: true,
            status: "Handed over. A specialist will reply in this WhatsApp chat. Tell the person that, briefly.",
          }
        : {
            success: true,
            reference: lead.id.slice(-6).toUpperCase(),
            whatsappLink: `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(text)}`,
            status: "Give the person the whatsappLink to reach a specialist now. If they shared a phone number, a specialist can also call them.",
          };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
