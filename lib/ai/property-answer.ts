import { formatAED } from "@/lib/utils";
import type { MarketInsights } from "@/lib/property/market-insights";

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
  floors?: number | null;
  floor?: number | null;
  description?: string | null;
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
  insights?: MarketInsights,
): string | null {
  const t = question.toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => t.includes(k));
  const title = p.title;
  const names = p.amenities.map((a) => a.amenity.name);
  const findAmenity = (re: RegExp) => names.find((n) => re.test(n));

  // Building transaction questions (from the market-insights comparables). Kept
  // before price/area so "price per sqft" / "last transaction" resolve here.
  if (insights) {
    const { sold, rented, trend } = insights;
    const psf = (x: { aed: number; area: number }) =>
      Math.round(x.aed / Math.max(1, x.area)).toLocaleString();

    // Price / rent direction over the last year.
    if (
      has(
        "trend",
        "increasing",
        "increase",
        "decreasing",
        "going up",
        "going down",
        "coming down",
        "come down",
        "rising",
        "falling",
        "appreciat",
        "depreciat",
        "growth",
        "outlook",
        "forecast",
        "higher or lower",
        "up or down",
      )
    ) {
      const isRent = has("rent", "rental", "lease");
      // `trend` is null when the comparables span too few months to state a
      // direction. The agent then says nothing about trends rather than
      // reading one off a fortnight of sales.
      const series = trend
        ? isRent
          ? trend.rent.primary
          : trend.sale.primary
        : [];
      if (trend && series.length >= 2) {
        // Window from the query: "2 years" / "18 months" / default 1 year,
        // capped to the data we actually have.
        const ym = t.match(/(\d+)\s*(?:year|yr|y)s?\b/);
        const mm = t.match(/(\d+)\s*months?\b/);
        let reqMonths = 12;
        if (ym) reqMonths = Number(ym[1]) * 12;
        else if (mm) reqMonths = Number(mm[1]);
        reqMonths = Math.max(1, reqMonths);
        const useMonths = Math.min(reqMonths, series.length);
        const capped = reqMonths > series.length;

        const w = series.slice(-useMonths);
        const start = w[0];
        const end = w[w.length - 1];
        const changePct = ((end - start) / Math.max(1, start)) * 100;
        const dir =
          changePct > 1 ? "risen" : changePct < -1 ? "eased" : "stayed broadly flat";
        const unit = isRent ? "sqft/yr" : "sqft";
        const label = isRent ? "Rents" : "Sale prices";

        const base =
          useMonths % 12 === 0 && useMonths >= 12
            ? useMonths / 12 === 1
              ? "year"
              : `${useMonths / 12} years`
            : `${useMonths} months`;
        const when = capped
          ? `over the past ${base} (the longest span on record)`
          : `over the past ${base}`;

        return `${label} in ${title} have ${dir} ${when} — about AED ${Math.round(
          start,
        ).toLocaleString()} → AED ${Math.round(end).toLocaleString()} per ${unit} (${
          changePct >= 0 ? "+" : ""
        }${changePct.toFixed(1)}%).`;
      }
    }

    if (
      has(
        "per sqft",
        "per sq ft",
        "psf",
        "per square",
        "aed/sqft",
        "price/sqft",
        "price per sq",
        "rate per",
      )
    ) {
      if (sold.length) {
        const avg = Math.round(
          sold.reduce((s, x) => s + x.aed / Math.max(1, x.area), 0) /
            sold.length,
        );
        return `In ${title}, recent sales average about AED ${avg.toLocaleString()} per sqft (latest: AED ${psf(sold[0])}/sqft on ${sold[0].date}).`;
      }
    }

    // Plural "history"/"transactions" → list recent rows (checked before the
    // singular "last sale" so "recent sales history" lists several).
    if (
      has(
        "transactions",
        "transaction history",
        "sales history",
        "recent sales",
        "sold history",
        "price history",
        "past sales",
      )
    ) {
      if (sold.length) {
        const lines = sold
          .slice(0, 3)
          .map(
            (x) => `${x.date} — ${formatAED(x.aed)} (${x.area.toLocaleString()} sqft)`,
          )
          .join("; ");
        return `Recent sales in ${title}: ${lines}.`;
      }
    }

    if (
      has(
        "last transaction",
        "last sale",
        "last sold",
        "latest sale",
        "latest transaction",
        "recent sale",
        "recently sold",
        "transaction value",
        "last deal",
        "most recent sale",
      )
    ) {
      if (sold.length) {
        const x = sold[0];
        return `The most recent sale in ${title} was ${formatAED(x.aed)} — ${x.area.toLocaleString()} sqft (AED ${psf(x)}/sqft), on ${x.date}.`;
      }
    }

    if (
      has(
        "last rent",
        "last rental",
        "latest rent",
        "recently rented",
        "last lease",
        "most recent rent",
      )
    ) {
      if (rented.length) {
        const x = rented[0];
        return `The most recent rental in ${title} was ${formatAED(x.aed)}/year — ${x.area.toLocaleString()} sqft (AED ${psf(x)}/sqft/yr), on ${x.date}.`;
      }
    }
  }

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

  // "Which floor is the unit on" — the unit's own level (check before the
  // building-height case so "what floor is this unit" isn't caught by it).
  if (has("which floor", "what floor", "which level", "what level"))
    return p.floor != null
      ? `This unit is on floor ${p.floor} of ${title}.`
      : `The unit's floor level isn't listed for ${title}.`;

  // Number of floors / storeys in the building. Prefer the structured field,
  // else pull it from the description ("twin towers rising up to 22 floors").
  if (
    has(
      "how many floor",
      "number of floor",
      "total floor",
      "floors are",
      "floors in",
      "how many stor",
      "storey",
      "stories",
      "how many level",
      "how tall",
    )
  ) {
    if (p.floors != null)
      return `${title} has ${p.floors} floor${p.floors === 1 ? "" : "s"}.`;
    const m = p.description?.match(
      /(?:up to\s*)?(\d{1,3})\s*-?\s*(?:floors?|storeys?|stor(?:ies|eys))\b/i,
    );
    if (m) return `${title} rises up to ${m[1]} floors.`;
    return `I don't have the number of floors on file for ${title}.`;
  }

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
    // Never fill a missing plan with a typical split — say it is not on file.
    if (pp.downPaymentPct == null)
      return `The payment plan isn't on file for ${title}. A property specialist can confirm it.`;
    const parts = [`${pp.downPaymentPct}% down payment`];
    if (pp.duringConstructionPct != null) parts.push(`${pp.duringConstructionPct}% during construction`);
    if (pp.onHandoverPct != null) parts.push(`${pp.onHandoverPct}% on handover`);
    return `Payment plan for ${title}: ${parts.join(", ")}.`;
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
    // Only dates on file — no assumed construction/handover dates.
    const construction = fmtDate(tl.constructionStart);
    const completion = fmtDate(tl.completion ?? meta.handoverDate);
    const parts: string[] = [];
    if (fmtDate(tl.announced)) parts.push(`announced ${fmtDate(tl.announced)}`);
    if (construction) parts.push(`construction started ${construction}`);
    if (completion) parts.push(`expected completion / handover ${completion}`);
    return parts.length
      ? `Project timeline for ${title}: ${parts.join(", ")}.`
      : `The construction and handover dates aren't on file for ${title}. A property specialist can confirm them.`;
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
