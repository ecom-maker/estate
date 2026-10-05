/**
 * Structured property descriptions.
 *
 * Reelly descriptions are one long text with fixed section headings on their
 * own lines ("Project general facts", "Location description and benefits",
 * sometimes "Finishing and materials", "Kitchen and appliances", "Furnishing").
 * `splitDescription` turns that text into sections by those headings, with no
 * AI involved. The result is stored in `properties.description_sections`; the
 * original `description` is never changed.
 *
 * `summary` and `highlights` are written by AI once per property
 * (scripts/structure-descriptions.ts) and stored next to it.
 */

export type DescriptionSection = {
  key: "about" | "location" | "finishes" | "kitchen" | "furnishing" | "other";
  heading: string;
  /** Paragraphs, in order. */
  paragraphs: string[];
};

const HEADINGS: { match: RegExp; key: DescriptionSection["key"]; heading: string }[] = [
  { match: /^project general facts$/i, key: "about", heading: "About the project" },
  { match: /^location description and benefits$/i, key: "location", heading: "Location" },
  { match: /^finishing and materials$/i, key: "finishes", heading: "Finishes and materials" },
  { match: /^kitchen and appliances$/i, key: "kitchen", heading: "Kitchen and appliances" },
  { match: /^furnishing$/i, key: "furnishing", heading: "Furnishing" },
];

/** Order on the page: what buyers read first. */
const ORDER: DescriptionSection["key"][] = ["about", "location", "finishes", "kitchen", "furnishing", "other"];

function headingFor(line: string) {
  const t = line.trim().replace(/[:：]$/, "");
  return HEADINGS.find((h) => h.match.test(t)) ?? null;
}

export function splitDescription(text: string | null | undefined): DescriptionSection[] {
  if (!text?.trim() || /^SEED DATA/i.test(text.trim())) return [];
  const sections = new Map<DescriptionSection["key"], DescriptionSection>();
  // Text before the first heading (admin-written descriptions have none) is "about".
  let current: DescriptionSection = { key: "about", heading: "About the project", paragraphs: [] };
  sections.set("about", current);

  for (const raw of text.replace(/\r\n?/g, "\n").replace(/<[^>]+>/g, " ").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const h = headingFor(line);
    if (h) {
      current = sections.get(h.key) ?? { key: h.key, heading: h.heading, paragraphs: [] };
      sections.set(h.key, current);
      continue;
    }
    current.paragraphs.push(line);
  }

  return ORDER.map((k) => sections.get(k)).filter(
    (s): s is DescriptionSection => Boolean(s && s.paragraphs.length),
  );
}

/** Reads the stored JSON column, falling back to splitting on the fly. */
export function descriptionSections(p: {
  description: string | null;
  descriptionSections?: unknown;
}): DescriptionSection[] {
  const stored = p.descriptionSections;
  if (Array.isArray(stored) && stored.length) return stored as DescriptionSection[];
  return splitDescription(p.description);
}

export function highlightList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

/** Short text for meta tags: the summary, else the start of the first section. */
export function metaDescription(p: {
  summary?: string | null;
  description: string | null;
  descriptionSections?: unknown;
}): string | undefined {
  const text = p.summary?.trim() || descriptionSections(p)[0]?.paragraphs.join(" ");
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}
