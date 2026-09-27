import {
  SearchIntentSchema,
  mergeSearchIntent,
  type SearchIntent,
} from "@/lib/validation/search-intent";
import { resolveLLMConfig, type LLMConfig } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";

const TYPE_MAP: Record<string, string> = {
  villa: "VILLA",
  apartment: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
};

// Fallback community list used when the DB lookup is unavailable.
const FALLBACK_COMMUNITIES = [
  "Palm Jumeirah",
  "Downtown Dubai",
  "Emirates Hills",
  "Dubai Marina",
  "Arabian Ranches",
  "Jumeirah",
  "Business Bay",
];

/** Classic Levenshtein edit distance (small strings, iterative two-row). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * True when `phrase` appears in `text` allowing for minor typos — e.g.
 * "emirates hils" still matches "Emirates Hills". Slides a same-word-count
 * window across the text and accepts a small edit distance (~1 typo / 6 chars).
 */
function fuzzyContains(text: string, phrase: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const t = normalize(text);
  const p = normalize(phrase);
  if (!p) return false;
  if (t.includes(p)) return true;

  const words = t.split(" ");
  const pWords = p.split(" ");
  const span = pWords.length;
  const tolerance = Math.max(1, Math.floor(p.length / 6));
  for (let i = 0; i + span <= words.length; i++) {
    const window = words.slice(i, i + span).join(" ");
    if (levenshtein(window, p) <= tolerance) return true;
  }
  return false;
}

export function extractSearchIntentHeuristic(
  message: string,
  previous?: SearchIntent | null,
  knownCommunities: string[] = FALLBACK_COMMUNITIES,
): SearchIntent {
  const text = message.toLowerCase();
  const next: SearchIntent = { ...(previous ?? {}), queryText: message };

  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (text.includes(key)) {
      next.propertyType = key as SearchIntent["propertyType"];
      void value;
      break;
    }
  }

  const bedMatch = text.match(/(\d+)\s*[- ]?\s*bed/);
  if (bedMatch) next.bedrooms = Number(bedMatch[1]);

  const bathMatch = text.match(/(\d+)\s*[- ]?\s*bath/);
  if (bathMatch) next.bathrooms = Number(bathMatch[1]);

  const maxPrice =
    text.match(/under\s*(?:aed\s*)?(\d+(?:\.\d+)?)\s*(m|million)?/i) ??
    text.match(/below\s*(?:aed\s*)?(\d+(?:\.\d+)?)\s*(m|million)?/i);
  if (maxPrice) {
    const amount = Number(maxPrice[1]);
    next.maxPriceAED = maxPrice[2] ? amount * 1_000_000 : amount;
  }

  if (
    text.includes("waterfront") ||
    text.includes("ocean view") ||
    text.includes("sea view")
  ) {
    next.waterfront = true;
  }
  if (text.includes("private beach")) next.privateBeach = true;
  if (text.includes("furnished")) next.furnished = true;

  // Completion status → offPlan (drives the badge and the status filter).
  // Handles typos like "competed"/"complated" for "completed".
  const wordsForStatus = text.split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""));
  const saysCompleted =
    /\bcomplet/.test(text) ||
    text.includes("move-in") ||
    text.includes("move in") ||
    text.includes("ready to move") ||
    wordsForStatus.some((w) => w.length >= 6 && levenshtein(w, "completed") <= 2);
  if (
    text.includes("off-plan") ||
    text.includes("off plan") ||
    text.includes("under construction") ||
    text.includes("under-construction")
  ) {
    next.offPlan = true;
  } else if (saysCompleted) {
    next.offPlan = false;
  }
  if (/\bready\b/.test(text)) next.ready = true;

  if (
    text.includes("for rent") ||
    text.includes("rental") ||
    text.includes("to rent") ||
    /\brent\b/.test(text) ||
    /\blease\b/.test(text)
  ) {
    next.dealType = "rent";
  } else if (
    text.includes("for sale") ||
    text.includes("to buy") ||
    text.includes("buy") ||
    text.includes("purchase")
  ) {
    next.dealType = "sale";
  }

  // Match the longest community name first so "Palm Jumeirah" wins over
  // "Jumeirah", then fall back to fuzzy matching for typos ("emirates hils").
  const communities = [...knownCommunities].sort((a, b) => b.length - a.length);
  for (const community of communities) {
    if (text.includes(community.toLowerCase())) {
      next.community = community;
      next.location = community;
      break;
    }
  }
  if (!next.community) {
    for (const community of communities) {
      if (fuzzyContains(message, community)) {
        next.community = community;
        next.location = community;
        break;
      }
    }
  }
  // Single distinctive word → community (e.g. "downtown" → "Downtown Dubai",
  // "marina" → "Dubai Marina"). Only tokens that map to exactly one community
  // are used, so ambiguous words like "dubai"/"jumeirah" are skipped here.
  if (!next.community) {
    const GENERIC = new Set(["dubai", "uae", "the", "and", "for"]);
    const tokenToCommunities = new Map<string, Set<string>>();
    for (const community of communities) {
      for (const word of community.toLowerCase().split(/\s+/)) {
        if (word.length < 4 || GENERIC.has(word)) continue;
        if (!tokenToCommunities.has(word)) {
          tokenToCommunities.set(word, new Set());
        }
        tokenToCommunities.get(word)!.add(community);
      }
    }
    const messageWords = text
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    outer: for (const [token, owners] of tokenToCommunities) {
      if (owners.size !== 1) continue; // unambiguous tokens only
      for (const word of messageWords) {
        if (word === token || levenshtein(word, token) <= 1) {
          const only = [...owners][0];
          next.community = only;
          next.location = only;
          break outer;
        }
      }
    }
  }

  if (text.includes("only waterfront")) next.waterfront = true;

  return SearchIntentSchema.parse(next);
}

async function getKnownCommunities(): Promise<string[]> {
  // Union the DB `Community` names with the curated list: some areas (e.g.
  // "Business Bay") appear only in property titles, not as Community records,
  // so relying on the DB alone would leave them undetectable.
  let dbNames: string[] = [];
  try {
    const rows = await prisma.community.findMany({ select: { name: true } });
    dbNames = rows.map((r) => r.name).filter((n): n is string => Boolean(n));
  } catch {
    dbNames = [];
  }

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...dbNames, ...FALLBACK_COMMUNITIES]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(name.trim());
  }
  return merged;
}

async function extractWithLLM(
  message: string,
  previous: SearchIntent | null | undefined,
  cfg: LLMConfig,
  knownCommunities: string[],
): Promise<SearchIntent | null> {
  const system = `Extract luxury real estate search intent as JSON only.
Merge with previous intent for follow-ups. Never invent numeric constraints not implied.
Schema keys: propertyType, dealType, location, community, developer, bedrooms, bathrooms, minPriceAED, maxPriceAED, minAreaSqft, maxAreaSqft, waterfront, privateBeach, furnished, offPlan, ready, amenities, queryText.
propertyType enum: villa|apartment|penthouse|townhouse|unit|land.
dealType enum: sale|rent (set "rent" for rent/rental/lease requests, "sale" for buy/purchase).
offPlan: true for off-plan / under-construction; false for completed / ready / move-in (also treat typos like "competed" as "completed").
Known communities (map misspellings/variants and partial names to the closest one — e.g. "downtown" → "Downtown Dubai", "marina" → "Dubai Marina" — and use its exact spelling in "community"; omit if no community is mentioned): ${knownCommunities.join(", ")}.`;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            previousIntent: previous ?? null,
            message,
          }),
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    // Providers may wrap JSON in prose or code fences — extract the object.
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = SearchIntentSchema.partial().parse(
      JSON.parse(match ? match[0] : content),
    );
    return mergeSearchIntent(previous, {
      ...parsed,
      queryText: message,
    });
  } catch {
    return null;
  }
}

export async function extractSearchIntent(
  message: string,
  previous?: SearchIntent | null,
): Promise<SearchIntent> {
  const [cfg, knownCommunities] = await Promise.all([
    resolveLLMConfig(),
    getKnownCommunities(),
  ]);
  if (cfg) {
    const llmIntent = await extractWithLLM(
      message,
      previous,
      cfg,
      knownCommunities,
    );
    // A community / status named in the CURRENT message always wins over what
    // was carried forward from the previous intent — so "what about business
    // bay" switches away from an earlier "palm jumeirah" instead of keeping it.
    // Passing previous=null limits detection to this message only.
    if (llmIntent) {
      const fresh = extractSearchIntentHeuristic(message, null, knownCommunities);
      if (fresh.community) {
        llmIntent.community = fresh.community;
        llmIntent.location = fresh.location;
      }
      if (fresh.offPlan != null) {
        llmIntent.offPlan = fresh.offPlan;
      }
      return llmIntent;
    }
  }
  return extractSearchIntentHeuristic(message, previous, knownCommunities);
}
