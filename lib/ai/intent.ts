import {
  SearchIntentSchema,
  mergeSearchIntent,
  type SearchIntent,
} from "@/lib/validation/search-intent";
import { resolveLLMConfig, type LLMConfig } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";
import { COMMUNITY_NAMES } from "@/lib/communities/catalog";

const TYPE_MAP: Record<string, string> = {
  villa: "VILLA",
  apartment: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
};

// Fallback community list (from the shared catalog) used to supplement the DB.
const FALLBACK_COMMUNITIES = COMMUNITY_NAMES;

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

  // Price — the negative lookahead stops "under 8500 sqft" being read as a price.
  const maxPrice =
    text.match(
      /under\s*(?:aed\s*)?(\d+(?:\.\d+)?)(?!\d)\s*(m|million)?(?!\s*(?:sq|square))/i,
    ) ??
    text.match(
      /below\s*(?:aed\s*)?(\d+(?:\.\d+)?)(?!\d)\s*(m|million)?(?!\s*(?:sq|square))/i,
    );
  if (maxPrice) {
    const amount = Number(maxPrice[1]);
    next.maxPriceAED = maxPrice[2] ? amount * 1_000_000 : amount;
  }

  // Area (sqft / sq ft / sqm). "under X" → max, "over/at least X" → min, and a
  // bare "X sqft" is treated as "around X" (±15% band) rather than exact, so a
  // close listing still matches. Commas in the number are ignored.
  const AREA_UNIT =
    "(?:sq\\s?\\.?\\s?ft|sqft|square\\s?f(?:ee|oo)t|sq\\s?\\.?\\s?m|sqm|square\\s?met(?:er|re)s?)";
  const AREA_NUM = "(\\d[\\d,]*(?:\\.\\d+)?)";
  const areaNum = (s: string) => Number(s.replace(/,/g, ""));
  const areaMax = text.match(
    new RegExp(
      `(?:under|below|less than|max(?:imum)?|up to|no more than)\\s*${AREA_NUM}\\s*${AREA_UNIT}`,
      "i",
    ),
  );
  const areaMin =
    text.match(
      new RegExp(
        `(?:over|above|at least|min(?:imum)?|more than|starting (?:from|at)|from)\\s*${AREA_NUM}\\s*${AREA_UNIT}`,
        "i",
      ),
    ) ?? text.match(new RegExp(`${AREA_NUM}\\s*\\+\\s*${AREA_UNIT}`, "i"));
  const areaBare = text.match(new RegExp(`${AREA_NUM}\\s*${AREA_UNIT}`, "i"));
  if (areaMax) {
    next.maxAreaSqft = areaNum(areaMax[1]);
  } else if (areaMin) {
    next.minAreaSqft = areaNum(areaMin[1]);
  } else if (areaBare) {
    const a = areaNum(areaBare[1]);
    next.minAreaSqft = Math.round(a * 0.85);
    next.maxAreaSqft = Math.round(a * 1.15);
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
  const saysOffPlan =
    text.includes("off-plan") ||
    text.includes("off plan") ||
    text.includes("offplan") ||
    text.includes("under construction") ||
    text.includes("under-construction") ||
    wordsForStatus.some((w) => w.length >= 6 && levenshtein(w, "offplan") <= 1);
  if (saysOffPlan) {
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

  // Detect a community named in THIS message. Kept in a local (not read from
  // `next`, which may already hold a community carried over from `previous`)
  // so a fuzzy/token match can OVERRIDE the earlier community on a follow-up
  // like "palm jumeria" or "what about downtown".
  const communities = [...knownCommunities].sort((a, b) => b.length - a.length);
  let detected: string | null = null;

  // 1) Exact substring — longest name first so "Palm Jumeirah" beats "Jumeirah".
  for (const community of communities) {
    if (text.includes(community.toLowerCase())) {
      detected = community;
      break;
    }
  }
  // 2) Fuzzy whole-name match for typos ("emirates hils", "palm jumeria").
  if (!detected) {
    for (const community of communities) {
      if (fuzzyContains(message, community)) {
        detected = community;
        break;
      }
    }
  }
  // 3) Single distinctive word → community ("downtown" → "Downtown Dubai",
  //    "marina" → "Dubai Marina"). Only tokens mapping to exactly one community
  //    are used, so ambiguous words like "dubai"/"jumeirah" are skipped here.
  if (!detected) {
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
          detected = [...owners][0];
          break outer;
        }
      }
    }
  }

  if (detected) {
    next.community = detected;
    next.location = detected;
  } else if (/\bdubai\b/.test(text)) {
    // "…in dubai" refers to the whole city, not a community — drop any specific
    // community (including one carried over from a previous search) so the
    // query searches across all of Dubai.
    next.community = undefined;
    next.location = undefined;
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
Area: "under X sqft" → maxAreaSqft; "over/at least X sqft" → minAreaSqft; a bare "X sqft" means "around X" → set minAreaSqft≈X*0.85 and maxAreaSqft≈X*1.15.
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
      const cityWide =
        !fresh.community && /\bdubai\b/.test(message.toLowerCase());
      if (fresh.community) {
        llmIntent.community = fresh.community;
        llmIntent.location = fresh.location;
      } else if (cityWide) {
        llmIntent.community = undefined;
        llmIntent.location = undefined;
      }
      if (fresh.offPlan != null) {
        llmIntent.offPlan = fresh.offPlan;
      }
      return llmIntent;
    }
  }
  return extractSearchIntentHeuristic(message, previous, knownCommunities);
}
