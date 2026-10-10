import { prisma } from "@/lib/db/prisma";

/**
 * "Contacts" are identifiable people (not anonymous visitors or AI agents),
 * aggregated across every surface they touched: WhatsApp and website chats,
 * leads, and footer/sell enquiries. People are unified by phone number first,
 * then email, then name — so one person's WhatsApp chat, a lead, and an enquiry
 * under the same number collapse into a single contact with one history.
 */

export type InteractionType = "whatsapp" | "web" | "lead" | "enquiry";

export type ContactMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
};

export type ContactInteraction = {
  type: InteractionType;
  date: Date;
  title: string;
  sessionId: string | null;
  messageCount: number;
  /** A short body shown when the row is expanded (lead notes, enquiry comment). */
  detail: string | null;
  /** Chat transcript, loaded only for the contact-detail view. */
  messages: ContactMessage[];
};

export type Contact = {
  id: string; // URL-safe handle for the contact key
  name: string | null;
  phone: string | null;
  email: string | null;
  lastContactAt: Date;
  interactionCount: number;
  interactions: ContactInteraction[];
};

function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** The unifying key: phone (7+ digits), else email, else name. "" = not identifiable. */
function keyFor(p: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  const d = digits(p.phone);
  if (d.length >= 7) return d;
  if (p.email?.trim()) return `email:${p.email.trim().toLowerCase()}`;
  if (p.name?.trim()) return `name:${p.name.trim().toLowerCase()}`;
  return "";
}

const encodeId = (key: string) => Buffer.from(key).toString("base64url");
const decodeId = (id: string) => {
  try {
    return Buffer.from(id, "base64url").toString("utf8");
  } catch {
    return "";
  }
};

type Bucket = {
  key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lastContactAt: Date;
  interactions: ContactInteraction[];
};

async function buildBuckets(): Promise<Map<string, Bucket>> {
  const [sessions, leads, enquiryLogs] = await Promise.all([
    prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3000,
      select: {
        id: true,
        channel: true,
        phone: true,
        title: true,
        updatedAt: true,
        user: { select: { name: true, email: true, phone: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        kind: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ["footer_enquiry", "sell_lead"] } },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: { id: true, action: true, meta: true, createdAt: true },
    }),
  ]);

  const map = new Map<string, Bucket>();
  const upsert = (
    ident: { name?: string | null; phone?: string | null; email?: string | null },
    interaction: ContactInteraction,
  ) => {
    const key = keyFor(ident);
    if (!key) return;
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        name: null,
        phone: null,
        email: null,
        lastContactAt: interaction.date,
        interactions: [],
      };
      map.set(key, b);
    }
    b.name = b.name || ident.name?.trim() || null;
    b.phone = b.phone || ident.phone?.trim() || null;
    b.email = b.email || ident.email?.trim() || null;
    if (interaction.date > b.lastContactAt) b.lastContactAt = interaction.date;
    b.interactions.push(interaction);
  };

  for (const s of sessions) {
    const ident =
      s.channel === "whatsapp"
        ? { phone: s.phone, name: null, email: null }
        : { phone: s.user?.phone, name: s.user?.name, email: s.user?.email };
    // Anonymous website chats (no user, no phone) aren't a contact.
    if (!keyFor(ident)) continue;
    upsert(ident, {
      type: s.channel === "whatsapp" ? "whatsapp" : "web",
      date: s.updatedAt,
      title:
        s.title ||
        (s.channel === "whatsapp" ? "WhatsApp conversation" : "Website chat"),
      sessionId: s.id,
      messageCount: s._count.messages,
      detail: null,
      messages: [],
    });
  }

  for (const l of leads) {
    upsert(
      { name: l.name, phone: l.phone, email: l.email },
      {
        type: "lead",
        date: l.createdAt,
        title: `Lead · ${l.kind}`,
        sessionId: null,
        messageCount: 0,
        detail: l.notes ?? null,
        messages: [],
      },
    );
  }

  for (const e of enquiryLogs) {
    const m = (e.meta ?? {}) as {
      name?: string;
      contact?: string;
      comment?: string;
      description?: string;
    };
    upsert(
      { name: m.name, phone: m.contact, email: null },
      {
        type: "enquiry",
        date: e.createdAt,
        title: e.action === "sell_lead" ? "Sell enquiry" : "Website enquiry",
        sessionId: null,
        messageCount: 0,
        detail: m.comment ?? m.description ?? null,
        messages: [],
      },
    );
  }

  return map;
}

function toContact(b: Bucket): Contact {
  const interactions = [...b.interactions].sort(
    (a, c) => c.date.getTime() - a.date.getTime(),
  );
  return {
    id: encodeId(b.key),
    name: b.name,
    phone: b.phone,
    email: b.email,
    lastContactAt: b.lastContactAt,
    interactionCount: interactions.length,
    interactions,
  };
}

/** All contacts, most-recently-contacted first (no transcripts loaded). */
export async function listContacts(): Promise<Contact[]> {
  const map = await buildBuckets();
  return [...map.values()]
    .map(toContact)
    .sort((a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime());
}

/** Distinct identifiable contacts — for the dashboard count. */
export async function countContacts(): Promise<number> {
  return (await buildBuckets()).size;
}

/** One contact with its full interaction history and chat transcripts. */
export async function getContactById(id: string): Promise<Contact | null> {
  const key = decodeId(id);
  if (!key) return null;
  const bucket = (await buildBuckets()).get(key);
  if (!bucket) return null;
  const contact = toContact(bucket);

  const sessionIds = contact.interactions
    .map((i) => i.sessionId)
    .filter((s): s is string => Boolean(s));
  if (sessionIds.length) {
    const msgs = await prisma.message.findMany({
      where: {
        sessionId: { in: sessionIds },
        role: { in: ["USER", "ASSISTANT"] },
      },
      orderBy: { createdAt: "asc" },
      select: { sessionId: true, role: true, content: true, createdAt: true },
    });
    const bySession = new Map<string, ContactMessage[]>();
    for (const m of msgs) {
      const list = bySession.get(m.sessionId) ?? [];
      list.push({
        role: m.role as "USER" | "ASSISTANT",
        content: m.content,
        createdAt: m.createdAt,
      });
      bySession.set(m.sessionId, list);
    }
    for (const i of contact.interactions) {
      if (i.sessionId) i.messages = bySession.get(i.sessionId) ?? [];
    }
  }

  return contact;
}
