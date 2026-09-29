import { formatAED } from "@/lib/utils";

type PropertyForAnswer = {
  title: string;
  bedrooms: number | null;
  bathrooms: number | null;
  priceAed: number | null;
  areaSqft: number | null;
  offPlan: boolean;
  rentalYield: number | null;
  reraStatus: string | null;
  community: { name: string } | null;
  developer: { name: string } | null;
  amenities: { amenity: { name: string } }[];
  paymentPlan?: unknown;
  metadata?: unknown;
};

function fmtDate(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

/**
 * Answer a specific factual question about one property directly from its data,
 * so "how many bedrooms?" returns "…has 2 bedrooms." instead of dumping the
 * whole fact sheet. Returns null for open-ended questions (handled by the LLM).
 */
export function answerPropertyQuestion(
  question: string,
  p: PropertyForAnswer,
): string | null {
  const t = question.toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => t.includes(k));
  const title = p.title;
  const names = p.amenities.map((a) => a.amenity.name);
  const findAmenity = (re: RegExp) => names.find((n) => re.test(n));

  // Specific amenity yes/no questions.
  if (has("parking", "garage", "car space", "car park")) {
    const m = findAmenity(/park|garage/i);
    return m
      ? `Yes — ${title} includes ${m.toLowerCase()}.`
      : `Parking isn't listed among the amenities for ${title}.`;
  }
  if (has("swimming pool", "pool")) {
    const m = findAmenity(/pool/i);
    return m
      ? `Yes — ${title} has a ${m.toLowerCase()}.`
      : `A pool isn't listed among the amenities for ${title}.`;
  }
  if (has("gym", "fitness")) {
    const m = findAmenity(/gym|fitness/i);
    return m
      ? `Yes — ${title} has a ${m.toLowerCase()}.`
      : `A gym isn't listed among the amenities for ${title}.`;
  }

  if (has("bedroom", "how many bed", " beds", "bed room"))
    return p.bedrooms != null
      ? `${title} has ${p.bedrooms} bedroom${p.bedrooms === 1 ? "" : "s"}.`
      : `The number of bedrooms isn't listed for ${title}.`;

  if (has("bathroom", "how many bath", " baths", "bath room", "toilet", "washroom"))
    return p.bathrooms != null
      ? `${title} has ${p.bathrooms} bathroom${p.bathrooms === 1 ? "" : "s"}.`
      : `The number of bathrooms isn't listed for ${title}.`;

  if (has("how big", "how large", "area", "size", "sqft", "sq ft", "square f", "built up", "built-up"))
    return p.areaSqft != null
      ? `${title} has a built-up area of ${p.areaSqft.toLocaleString()} sqft.`
      : `The area isn't listed for ${title}.`;

  if (has("price", "how much", "cost", "asking", "budget"))
    return p.priceAed != null
      ? `${title} is priced at ${formatAED(p.priceAed)}.`
      : `The price isn't listed for ${title}.`;

  if (has("community", "which area", "where is", "neighbou", "located", "location"))
    return p.community
      ? `${title} is located in ${p.community.name}.`
      : `The community isn't listed for ${title}.`;

  if (has("developer", "builder", "who built", "built by", "by which"))
    return p.developer
      ? `${title} is developed by ${p.developer.name}.`
      : `The developer isn't listed for ${title}.`;

  if (has("payment plan", "payment", "installment", "instalment", "down payment", "how to pay", "post handover", "post-handover")) {
    const pp = (p.paymentPlan ?? {}) as {
      downPaymentPct?: number;
      duringConstructionPct?: number;
      onHandoverPct?: number;
    };
    const down = pp.downPaymentPct ?? 20;
    const during = pp.duringConstructionPct ?? 40;
    const handover = pp.onHandoverPct ?? 40;
    return `Payment plan for ${title}: ${down}% down payment at sales launch, ${during}% during construction, and ${handover}% on handover.`;
  }

  if (has("timeline", "handover", "completion", "complete", "when will", "when is", "ready by", "delivery", "construction")) {
    const meta = (p.metadata ?? {}) as {
      handoverDate?: string;
      timeline?: {
        announced?: string;
        constructionStart?: string;
        completion?: string;
      };
    };
    const tl = meta.timeline ?? {};
    const parts: string[] = [];
    if (fmtDate(tl.announced)) parts.push(`announced ${fmtDate(tl.announced)}`);
    if (fmtDate(tl.constructionStart))
      parts.push(`construction started ${fmtDate(tl.constructionStart)}`);
    const completion = fmtDate(tl.completion ?? meta.handoverDate);
    if (completion) parts.push(`expected completion / handover ${completion}`);
    return parts.length
      ? `Project timeline for ${title}: ${parts.join(", ")}.`
      : `The project timeline isn't listed yet for ${title}.`;
  }

  if (has("off-plan", "off plan", "offplan", "ready", "status", "under construction"))
    return `${title} is ${p.offPlan ? "off-plan (under construction)" : "ready / completed"}.`;

  if (has("yield", "roi", "rental return", "return on"))
    return p.rentalYield != null
      ? `The rental yield on file for ${title} is ${p.rentalYield}%.`
      : `The rental yield isn't available for ${title}.`;

  if (has("rera", "approval", "registered"))
    return p.reraStatus
      ? `RERA / approval for ${title}: ${p.reraStatus}.`
      : `RERA / approval status isn't available for ${title}.`;

  if (has("amenit", "facilit", "feature", "what does it have", "what is included", "what's included"))
    return names.length
      ? `${title} amenities: ${names.join(", ")}.`
      : `Amenities aren't listed for ${title}.`;

  return null;
}
