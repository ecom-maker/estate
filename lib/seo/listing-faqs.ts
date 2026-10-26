import { formatAED } from "@/lib/utils";
import { DEAL_LABELS, type ParsedListingSlug } from "@/lib/seo/listing-slug";

/**
 * Data-driven FAQs for a /[listing] location page.
 *
 * Written to be quoted by answer engines (ChatGPT, Perplexity, Google AI
 * Overviews): every answer is self-contained and names real projects and real
 * prices from the page's own inventory — e.g. "best off-plan in Ajman under
 * AED 600,000" — rather than generic boilerplate. Rendered visibly AND emitted
 * as FAQPage JSON-LD by the page.
 */

type FaqUnit = {
  priceAed: number | null;
  bedrooms: number | null;
  property: { title: string };
};
type FaqDevelopment = {
  title: string;
  priceAed: number | null;
  offPlan: boolean;
};

export type Faq = { q: string; a: string };

// Round budget tiers buyers actually search ("under 600k", "under 1M", …).
// The page picks the tier that fits the locality's real off-plan prices.
const BUDGET_LADDER = [
  500_000, 600_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
  5_000_000, 10_000_000, 20_000_000,
];

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildListingFaqs({
  parsed,
  localityName,
  units,
  developments,
}: {
  parsed: ParsedListingSlug;
  localityName: string;
  units: FaqUnit[];
  developments: FaqDevelopment[];
}): Faq[] {
  const type = parsed.typeDef.label.toLowerCase();
  const singular = parsed.typeDef.singular;
  const dealLower = DEAL_LABELS[parsed.deal].toLowerCase(); // "for sale"/"for rent"
  const dealVerb = parsed.deal === "sale" ? "buy" : "rent";
  const isSale = parsed.deal === "sale";
  const faqs: Faq[] = [];

  const pricedUnits = units
    .filter((u): u is FaqUnit & { priceAed: number } =>
      typeof u.priceAed === "number" && u.priceAed > 0,
    )
    .sort((a, b) => a.priceAed - b.priceAed);
  const unitPrices = pricedUnits.map((u) => u.priceAed);

  const offPlan = developments
    .filter(
      (d): d is FaqDevelopment & { priceAed: number } =>
        d.offPlan && typeof d.priceAed === "number" && d.priceAed > 0,
    )
    .sort((a, b) => a.priceAed - b.priceAed);

  // 1) Headline GEO question: best off-plan under a locality-appropriate budget.
  if (isSale && offPlan.length) {
    // Tier from the CHEAPEST off-plan start price, so the budget framing is as
    // low (and as search-matching) as the real inventory truthfully allows —
    // budget areas surface "under 500k/600k", premium areas land higher. Never
    // invent a tier with no inventory under it.
    const ref = offPlan[0].priceAed;
    const threshold =
      BUDGET_LADDER.find((t) => t >= ref) ?? Math.ceil(ref / 100_000) * 100_000;
    const under = offPlan.filter((d) => d.priceAed <= threshold);
    if (under.length) {
      const noun = under.length === 1 ? singular : type;
      const verb = under.length === 1 ? "is" : "are";
      const picks = under
        .slice(0, 4)
        .map((d) => `${d.title} (from ${formatAED(d.priceAed)})`);
      const lead =
        under.length === 1
          ? `The most affordable is ${picks[0]}`
          : `The most affordable include ${joinAnd(picks)}`;
      faqs.push({
        q: `What are the best off-plan ${type} in ${localityName} under ${formatAED(threshold)}?`,
        a:
          `${under.length} off-plan ${noun} in ${localityName} ${verb} listed under ${formatAED(threshold)} on DM Global. ` +
          `${lead}. All prices are starting figures from verified developer listings.`,
      });
    }
  }

  // 2) Cheapest listing, by name and price.
  if (pricedUnits.length) {
    const c = pricedUnits[0];
    faqs.push({
      q: `What is the cheapest ${singular} ${dealLower} in ${localityName}?`,
      a: `The most affordable ${singular} currently listed in ${localityName} is at ${c.property.title}, from ${formatAED(c.priceAed)}.`,
    });
  }

  // 3) Price range, with real numbers from current inventory.
  if (unitPrices.length >= 2) {
    faqs.push({
      q: `What is the price range of ${type} ${dealLower} in ${localityName}?`,
      a: `${cap(type)} ${dealLower} in ${localityName} range from ${formatAED(unitPrices[0])} to ${formatAED(unitPrices[unitPrices.length - 1])} among current listings on DM Global, depending on size, floor, view and finishing.`,
    });
  }

  // 4) Off-plan availability + named projects.
  const offPlanAll = developments.filter((d) => d.offPlan);
  if (isSale && offPlanAll.length) {
    const names = [...new Set(offPlanAll.map((d) => d.title))].slice(0, 3);
    const noun = offPlanAll.length === 1 ? singular : type;
    const verb = offPlanAll.length === 1 ? "is" : "are";
    faqs.push({
      q: `Are there off-plan ${type} in ${localityName}?`,
      a:
        `Yes — ${offPlanAll.length} off-plan ${noun} in ${localityName} ${verb} listed on DM Global` +
        `${names.length ? `, including ${joinAnd(names)}` : ""}. Handover timelines and payment plans vary by project.`,
    });
  }

  // 5) Evergreen next-step (always useful, keeps a thin page from being bare).
  faqs.push({
    q: `How do I ${dealVerb} a ${singular} in ${localityName}?`,
    a: `Open any listing to see full details, then use the enquiry option to reach the agent, ask about payment plans and handover, or arrange a viewing.`,
  });

  // Fallback when there's no priced inventory to describe yet.
  if (faqs.length < 2) {
    faqs.unshift({
      q: `How many ${type} are available ${dealLower} in ${localityName}?`,
      a: `We list verified ${type} ${dealLower} in ${localityName} from trusted developers and owners, updated regularly as new inventory is added.`,
    });
  }

  return faqs;
}
