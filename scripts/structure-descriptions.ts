/**
 * Fills the structured description fields on every live property:
 *   description_sections  split from `description` by its headings (no AI)
 *   summary, highlights   written by the LLM, from the description text only
 *
 * Runs only where needed: a property is (re)done when its summary is empty or
 * when its stored sections no longer match its current description, i.e. the
 * text changed since the AI last read it (admin edits also clear the summary).
 * Unchanged properties cost nothing. `description` itself is never modified.
 *
 * Guard: every number in the AI's text must appear in the source text, so it
 * cannot invent prices, sizes or dates. A result that fails is retried once,
 * then skipped (the page still shows the sections without a summary).
 *
 * Usage (DATABASE_URL + LLM_API_KEY/LLM_BASE_URL/LLM_MODEL in the environment):
 *   npx tsx scripts/structure-descriptions.ts            dry run: lists what would change
 *   npx tsx scripts/structure-descriptions.ts --write    writes to the DB
 *   ... --force                                          redo every property
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { splitDescription, type DescriptionSection } from "../lib/property/description";

const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");

const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const baseUrl = (process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const model = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const PROMPT = `You write the summary and key points for a real-estate project page.
Use ONLY facts stated in the text you are given. Never add facts, numbers, prices, dates, distances or amenities that are not in it.
Write any number exactly as the text writes it (if it says "two-bedroom", don't write "2-bedroom").
No marketing filler ("luxury living at its finest", "a lifestyle like no other").
Return JSON: {"summary": string, "highlights": string[]}
- summary: 2-3 plain sentences, under 60 words: what it is, where, who it suits.
- highlights: 4-6 short key points, each under 12 words, no full stops, most useful to a buyer first (unit types, design/brand, finishes, location advantages).`;

const Result = z.object({
  summary: z.string().min(20).max(600),
  highlights: z.array(z.string().min(3).max(120)).min(3).max(6),
});

const numbers = (s: string) => (s.replace(/(\d),(\d)/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []);

/** Numbers in the AI's output that the source text doesn't contain. */
function invented(out: z.infer<typeof Result>, source: string): string[] {
  const known = new Set(numbers(source));
  return numbers([out.summary, ...out.highlights].join(" ")).filter((n) => !known.has(n));
}

/** Order-independent fingerprint: JSONB may return object keys in another order. */
function signature(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return JSON.stringify(
    (value as DescriptionSection[]).map((s) => [s.key, s.heading, s.paragraphs]),
  );
}

async function ask(title: string, source: string, note = ""): Promise<z.infer<typeof Result>> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Project: ${title}\n\n${source}${note}` },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (json.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  return Result.parse(JSON.parse(text));
}

async function main() {
  if (!apiKey) throw new Error("Set LLM_API_KEY (and LLM_BASE_URL / LLM_MODEL).");
  const prisma = new PrismaClient();
  const rows = await prisma.property.findMany({
    where: { deletedAt: null, description: { not: null } },
    select: { id: true, title: true, description: true, descriptionSections: true, summary: true },
    orderBy: { title: "asc" },
  });

  let done = 0, skipped = 0, failed = 0;
  for (const p of rows) {
    const sections = splitDescription(p.description);
    if (!sections.length) continue;
    const changed = signature(sections) !== signature(p.descriptionSections);
    if (!FORCE && !changed && p.summary) {
      skipped++;
      continue;
    }
    const source = sections
      .map((s: DescriptionSection) => `${s.heading}\n${s.paragraphs.join("\n")}`)
      .join("\n\n");

    let out: z.infer<typeof Result> | null = null;
    let problem = "";
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try {
        const r = await ask(p.title, source, problem && `\n\n(Your previous answer used numbers not in the text: ${problem}. Leave them out.)`);
        const bad = invented(r, source);
        if (bad.length) problem = bad.join(", ");
        else out = r;
      } catch (e) {
        problem = e instanceof Error ? e.message : String(e);
      }
    }

    if (!out) {
      failed++;
      console.log(`✗ ${p.title}: ${problem}`);
      // Sections still get stored, so the page is structured even without a summary.
      if (WRITE && changed) {
        await prisma.property.update({
          where: { id: p.id },
          data: { descriptionSections: sections as unknown as Prisma.InputJsonValue },
        });
      }
      continue;
    }

    done++;
    console.log(`✓ ${p.title}\n  ${out.summary}\n  - ${out.highlights.join("\n  - ")}`);
    if (WRITE) {
      await prisma.property.update({
        where: { id: p.id },
        data: {
          descriptionSections: sections as unknown as Prisma.InputJsonValue,
          summary: out.summary,
          highlights: out.highlights,
        },
      });
    }
  }

  console.log(`\n${done} written, ${skipped} unchanged, ${failed} failed${WRITE ? "" : " (dry run, nothing saved)"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
