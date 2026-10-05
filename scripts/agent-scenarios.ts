/**
 * Conversation tests for the AI sales agent, run against the real inventory
 * and LLM (reads .env.local). Prints each transcript with the tools used.
 *
 *   npx tsx scripts/agent-scenarios.ts            all scenarios
 *   npx tsx scripts/agent-scenarios.ts viewing    only scenarios whose name contains "viewing"
 *
 * Leads written by the run use session ids starting "scenario-" and are
 * deleted at the end.
 */
import { prisma } from "@/lib/db/prisma";
import { runSalesAgent, type AgentTurn } from "@/lib/ai/agent/run";

type Scenario = { name: string; channel?: "web" | "whatsapp"; property?: string; turns: string[] };

const SCENARIOS: Scenario[] = [
  { name: "greeting", turns: ["hi"] },
  { name: "vague apartment -> discovery", turns: ["I want an apartment", "Mainly as an investment, rental income", "Around 2 million AED, Dubai"] },
  { name: "specific search", turns: ["Show me 2 bedroom apartments in Dubai Marina under 3M"] },
  { name: "unrealistic expectation", turns: ["I want a beachfront villa in Palm Jumeirah for AED 3 million"] },
  { name: "price of specific project", turns: ["How much is Hillsedge?"] },
  { name: "project payment plan + handover", turns: ["Tell me about Bayz 102", "What's the payment plan and when is handover?"] },
  { name: "availability", turns: ["Is there a 3 bedroom available in Damac Bay 2?"] },
  { name: "developer", turns: ["Which projects does Emaar have?", "What is Emaar's track record on delivery?"] },
  { name: "areas", turns: ["Where do you have projects?"] },
  { name: "rental", turns: ["I want to rent a 1 bedroom in JVC, furnished, around 80k a year"] },
  { name: "yield / ROI", turns: ["What rental yield will I get in Lume Residences? Guaranteed?"] },
  { name: "discount negotiation", turns: ["Can you give me 10% off Coastal Haven?"] },
  { name: "price objection", turns: ["Show me 2 bed in Dubai Islands", "That's too expensive", "I can only spend 2.2 million"] },
  { name: "human transfer", turns: ["Can I speak to a real person please"] },
  { name: "viewing booking", turns: ["I'd like to view Hillsedge", "Tomorrow at 11am", "Sara, +971 50 123 4567"] },
  { name: "brochure", turns: ["Can you send me the brochure for Sonate Residences?"] },
  { name: "just send properties", turns: ["Just send me properties"] },
  { name: "change of mind", turns: ["2 bed in Business Bay under 3M", "Actually forget Business Bay, show me Downtown instead"] },
  { name: "not interested", turns: ["I'm not interested, stop"] },
  { name: "off-topic", turns: ["who won the football world cup?"] },
  { name: "are you human", turns: ["Are you a real person or a bot?"] },
  { name: "property page question", property: "Hillsedge", turns: ["How much is this?", "Does it have a gym?"] },
  { name: "whatsapp callback", channel: "whatsapp", turns: ["Can someone call me tomorrow afternoon about off-plan in JVC? My name is Ali"] },
  { name: "arabic", turns: ["أبحث عن شقة بغرفتين في دبي مارينا"] },
];

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const run = SCENARIOS.filter((s) => !filter || s.name.toLowerCase().includes(filter));
  const sessions: string[] = [];
  for (const s of run) {
    const sessionId = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessions.push(sessionId);
    let currentProperty: { id: string; title: string } | null = null;
    if (s.property) {
      const p = await prisma.property.findFirst({ where: { title: s.property, deletedAt: null } });
      currentProperty = p ? { id: p.id, title: p.title } : null;
    }
    console.log(`\n================ ${s.name} ${s.channel === "whatsapp" ? "(whatsapp)" : ""}`);
    const history: AgentTurn[] = [];
    for (const message of s.turns) {
      const t0 = Date.now();
      const r = await runSalesAgent({
        history,
        message,
        channel: s.channel ?? "web",
        sessionId,
        phone: s.channel === "whatsapp" ? "971501112233" : null,
        currentProperty,
      });
      console.log(`\nUSER: ${message}`);
      if (!r) {
        console.log("AGENT: <null — fallback would be used>");
        break;
      }
      console.log(
        `  [${((Date.now() - t0) / 1000).toFixed(1)}s · tools: ${r.tools.map((t) => `${t.name}${t.ok ? "" : "!"}`).join(", ") || "none"} · results: ${r.propertyIds?.length ?? "-"} · leads: ${r.leadIds.length}]`,
      );
      console.log(`AGENT: ${r.reply}`);
      history.push({ role: "user", content: message }, { role: "assistant", content: r.reply });
    }
  }
  const leads = await prisma.lead.findMany({ where: { sessionId: { in: sessions } } });
  for (const l of leads) console.log(`\nLEAD ${l.kind}: ${l.name ?? "-"} ${l.phone ?? ""} ${l.email ?? ""} ${l.preferredDate ?? ""} ${l.preferredTime ?? ""} ${JSON.stringify(l.requirements ?? {})}`);
  await prisma.lead.deleteMany({ where: { sessionId: { in: sessions } } });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
