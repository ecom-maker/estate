import {
  SearchIntentSchema,
  mergeSearchIntent,
  type SearchIntent,
} from "@/lib/validation/search-intent";
import { resolveLLMConfig, type LLMConfig } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";
import { COMMUNITY_NAMES } from "@/lib/communities/catalog";

// Real-estate vocabulary used to tell property questions apart from off-topic
// ones ("who is donald trump?") when the query carries no structured signal.
const REAL_ESTATE_KEYWORDS = [
  "propert",
  "home",
  "house",
  "apartment",
  "flat",
  "villa",
  "penthouse",
  "townhouse",
  "duplex",
  "studio",
  "unit",
  "land",
  "plot",
  "listing",
  "real estate",
  "realestate",
  "bed",
  "bath",
  "sqft",
  "sq ft",
  "square f",
  "price",
  "budget",
  "aed",
  "dirham",
  "million",
  "buy",
  "rent",
  "sale",
  "sell",
  "lease",
  "invest",
  "yield",
  "mortgage",
  "off-plan",
  "off plan",
  "offplan",
  "ready",
  "handover",
  "waterfront",
  "beach",
  "sea view",
  "amenit",
  "developer",
  "community",
  "neighbou",
  "project",
  "dubai",
  "emirate",
  "uae",
  "floor",
  "balcony",
  "maid",
  "garden",
  "pool",
  "payment plan",
  "available",
  "show me",
  "looking for",
  "need a",
  "want a",
  "find me",
  "search",
  "furnished",
  "rooms",
  "bedroom",
  "bathroom",
];

/**
 * True when a query is about real estate — either it produced a structured
 * intent signal, or its text contains property vocabulary. Used to decline
 * off-topic questions instead of running a blind search.
 */
export function isRealEstateQuery(
  message: string,
  intent: SearchIntent,
): boolean {
  if (
    intent.propertyType ||
    intent.propertyTypes?.length ||
    intent.community ||
    intent.location ||
    intent.developer ||
    intent.bedrooms != null ||
    intent.bedroomsList?.length ||
    intent.bathrooms != null ||
    intent.bathroomsList?.length ||
    intent.minPriceAED != null ||
    intent.maxPriceAED != null ||
    intent.minAreaSqft != null ||
    intent.maxAreaSqft != null ||
    intent.waterfront != null ||
    intent.privateBeach != null ||
    intent.furnished != null ||
    intent.offPlan != null ||
    intent.ready != null ||
    intent.dealType
  ) {
    return true;
  }
  const text = message.toLowerCase();
  return REAL_ESTATE_KEYWORDS.some((k) => text.includes(k));
}

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

/**
 * True when the message broadens the location to the whole city / no specific
 * community — "in dubai", "anywhere", "any location", "all areas". Used to drop
 * a community carried over from a previous search.
 */
function mentionsBroadLocation(text: string): boolean {
  return (
    /\bdubai\b/.test(text) ||
    /\bany\s?where\b/.test(text) ||
    /\beverywhere\b/.test(text) ||
    /\ball\s+(?:areas|locations|communities)\b/.test(text) ||
    /\bany\s+(?:location|area|community|neighbou?rhood)\b/.test(text)
  );
}

export function extractSearchIntentHeuristic(
  message: string,
  previous?: SearchIntent | null,
  knownCommunities: string[] = FALLBACK_COMMUNITIES,
): SearchIntent {
  const text = message.toLowerCase();
  const next: SearchIntent = { ...(previous ?? {}), queryText: message };

  // Collect every property type mentioned (word-boundary so "land" ignores
  // "island"/"Highland"). One → propertyType; several → propertyTypes (any-of).
  const foundTypes = (
    Object.keys(TYPE_MAP) as (keyof typeof TYPE_MAP)[]
  ).filter((key) => new RegExp(`\\b${key}s?\\b`).test(text));
  if (foundTypes.length) {
    next.propertyType = foundTypes[0] as SearchIntent["propertyType"];
    next.propertyTypes =
      foundTypes.length > 1
        ? (foundTypes as SearchIntent["propertyTypes"])
        : undefined;
  }

  // Bedrooms — collect every "N bed" (plus "studio" → 0). One → bedrooms (min /
  // "N+"); several → bedroomsList (exact any-of).
  const bedNums = [...text.matchAll(/(\d+)\s*[- ]?\s*bed/gi)].map((m) =>
    Number(m[1]),
  );
  if (/\bstudio\b/.test(text)) bedNums.push(0);
  const uniqBeds = [...new Set(bedNums)].sort((a, b) => a - b);
  if (uniqBeds.length) {
    next.bedrooms = uniqBeds[0];
    next.bedroomsList = uniqBeds.length > 1 ? uniqBeds : undefined;
  }

  const bathNums = [...text.matchAll(/(\d+)\s*[- ]?\s*bath/gi)].map((m) =>
    Number(m[1]),
  );
  const uniqBaths = [...new Set(bathNums)].sort((a, b) => a - b);
  if (uniqBaths.length) {
    next.bathrooms = uniqBaths[0];
    next.bathroomsList = uniqBaths.length > 1 ? uniqBaths : undefined;
  }

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
  const minPrice = text.match(
    /(?:over|above|at least|minimum|min|starting (?:from|at))\s*(?:aed\s*)?(\d+(?:\.\d+)?)(?!\d)\s*(m|million)?(?!\s*(?:sq|square))/i,
  );
  if (minPrice) {
    const amount = Number(minPrice[1]);
    next.minPriceAED = minPrice[2] ? amount * 1_000_000 : amount;
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
  } else if (mentionsBroadLocation(text)) {
    // "in dubai" / "anywhere" / "any location" → search the whole city, so drop
    // any specific community (including one carried over from a previous search).
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
Schema keys: propertyType, propertyTypes, dealType, location, community, developer, bedrooms, bathrooms, bedroomsList, bathroomsList, minPriceAED, maxPriceAED, minAreaSqft, maxAreaSqft, waterfront, privateBeach, furnished, offPlan, ready, amenities, queryText.
propertyType enum: villa|apartment|penthouse|townhouse|unit|land. When several types are requested, list them in propertyTypes (same enum). When several bedroom or bathroom counts are requested, list them in bedroomsList / bathroomsList.
dealType enum: sale|rent (set "rent" for rent/rental/lease requests, "sale" for buy/purchase).
offPlan: true for off-plan / under-construction; false for completed / ready / move-in (also treat typos like "competed" as "completed").
Price: "under/below X" → maxPriceAED; "over/above/at least X" → minPriceAED (X may use m/million).
Area: "under X sqft" → maxAreaSqft; "over/at least X sqft" → minAreaSqft; a bare "X sqft" means "around X" → set minAreaSqft≈X*0.85 and maxAreaSqft≈X*1.15.
Known communities (map misspellings/variants and partial names to the closest one — e.g. "downtown" → "Downtown Dubai", "marina" → "Dubai Marina" — and use its exact spelling in "community"; omit if no community is mentioned): ${knownCommunities.join(", ")}.`;

  // Cap how long we wait on the model for intent — if it is slow, fall back to
  // the (robust) heuristic so search stays responsive.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
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
      signal: controller.signal,
    });
  } catch {
    return null; // timeout or network error → heuristic fallback
  } finally {
    clearTimeout(timer);
  }

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
  // The heuristic is fast (<5ms) and handles typos, communities, multi-select,
  // price/area/beds, status and deal type — so it's the default. The LLM pass
  // (slower, and its timeout doesn't reliably abort) is opt-in via env.
  const llmEnabled = process.env.AI_INTENT_ENABLED === "true";
  const knownCommunities = await getKnownCommunities();

  const cfg = llmEnabled ? await resolveLLMConfig() : null;
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
      const broaden =
        !fresh.community && mentionsBroadLocation(message.toLowerCase());
      if (fresh.community) {
        llmIntent.community = fresh.community;
        llmIntent.location = fresh.location;
      } else if (broaden) {
        llmIntent.community = undefined;
        llmIntent.location = undefined;
      }
      if (fresh.offPlan != null) {
        llmIntent.offPlan = fresh.offPlan;
      }
      // Multi-select fields: the LLM tends to return a single value, so take
      // the arrays detected in the current message when there is more than one.
      if (fresh.propertyTypes?.length) {
        llmIntent.propertyTypes = fresh.propertyTypes;
        llmIntent.propertyType = fresh.propertyType;
      }
      if (fresh.bedroomsList?.length) {
        llmIntent.bedroomsList = fresh.bedroomsList;
        llmIntent.bedrooms = fresh.bedrooms;
      }
      if (fresh.bathroomsList?.length) {
        llmIntent.bathroomsList = fresh.bathroomsList;
        llmIntent.bathrooms = fresh.bathrooms;
      }
      return llmIntent;
    }
  }
  return extractSearchIntentHeuristic(message, previous, knownCommunities);
}
