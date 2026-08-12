import type { SearchIntent } from "@/lib/validation/search-intent";

const TYPE_MAP: Record<string, string> = {
  villa: "VILLA",
  apartment: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
};

export function extractSearchIntentHeuristic(
  message: string,
  previous?: SearchIntent | null,
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

  if (text.includes("waterfront") || text.includes("ocean view") || text.includes("sea view")) {
    next.waterfront = true;
  }
  if (text.includes("private beach")) next.privateBeach = true;
  if (text.includes("furnished")) next.furnished = true;
  if (text.includes("off-plan") || text.includes("off plan")) next.offPlan = true;
  if (text.includes("ready")) next.ready = true;

  const communities = [
    "palm jumeirah",
    "downtown dubai",
    "emirates hills",
    "dubai marina",
    "arabian ranches",
    "jumeirah",
    "business bay",
  ];
  for (const community of communities) {
    if (text.includes(community)) {
      next.community = community
        .split(" ")
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" ");
      next.location = next.community;
      break;
    }
  }

  if (text.includes("only waterfront")) next.waterfront = true;

  return next;
}
