import { formatAED } from "@/lib/utils";
import { DEAL_LABELS, type ParsedListingSlug } from "@/lib/seo/listing-slug";
import { type Faq, perSqft, joinAnd, compactFaqs } from "@/lib/seo/faq";

/**
 * 4–5 aggregated FAQs for a /[listing] location/type page, generated from the
 * page's real inventory so answer engines (ChatGPT, Perplexity, AI Overviews)
 * can quote them. Each answer leads with the fact and its number; questions
 * whose source data is missing are omitted.
 */

type FaqUnit = {
  priceAed: number | null;
  areaSqft: number | null;
  property: { title: string };
};
type FaqDevelopment = {
  title: string;
  priceAed: number | null;
  offPlan: boolean;
  developerName?: string | null;
};

// Round budget tiers buyers actually search ("under 600k", "under 1M", …).
const BUDGET_LADDER = [
  500_000, 600_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
  5_000_000, 10_000_000, 20_000_000,
];

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
  const dealLower = DEAL_LABELS[parsed.deal].toLowerCase(); // "for sale"/"for rent"
  const isSale = parsed.deal === "sale";
  const faqs: Faq[] = [];

  const priced = units
    .filter((u): u is FaqUnit & { priceAed: number } =>
      typeof u.priceAed === "number" && u.priceAed > 0,
    )
    .sort((a, b) => a.priceAed - b.priceAed);
  const prices = priced.map((u) => u.priceAed);

  const offPlan = developments
    .filter(
      (d): d is FaqDevelopment & { priceAed: number } =>
        d.offPlan && typeof d.priceAed === "number" && d.priceAed > 0,
    )
    .sort((a, b) => a.priceAed - b.priceAed);

  // 1) Best off-plan under a locality-appropriate budget (GEO headline).
  if (isSale && offPlan.length) {
    const ref = offPlan[0].priceAed;
    const threshold =
      BUDGET_LADDER.find((t) => t >= ref) ?? Math.ceil(ref / 100_000) * 100_000;
    const under = offPlan.filter((d) => d.priceAed <= threshold);
    if (under.length) {
      const noun = under.length === 1 ? parsed.typeDef.singular : type;
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

  // 2) Price range.
  if (prices.length >= 2) {
    faqs.push({
      q: `What is the price range of ${type} ${dealLower} in ${localityName}?`,
      a: `${cap(type)} ${dealLower} in ${localityName} range from ${formatAED(prices[0])} to ${formatAED(prices[prices.length - 1])} among current listings on DM Global, depending on size, floor, view and finishing.`,
    });
  }

  // 3) Off-plan vs completed project count.
  if (developments.length) {
    const off = developments.filter((d) => d.offPlan).length;
    const done = developments.length - off;
    faqs.push({
      q: `How many off-plan and completed ${type} projects are there in ${localityName}?`,
      a: `In ${localityName}, ${off} ${type} project${off === 1 ? " is" : "s are"} off-plan and ${done} ${done === 1 ? "is" : "are"} completed, from ${developments.length} development${developments.length === 1 ? "" : "s"} listed on DM Global.`,
    });
  }

  // 4) Average price per sqft.
  const perSqftValues = priced
    .map((u) =>
      u.areaSqft && u.areaSqft > 0 ? u.priceAed / u.areaSqft : null,
    )
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (perSqftValues.length >= 3) {
    const avg = perSqftValues.reduce((s, n) => s + n, 0) / perSqftValues.length;
    faqs.push({
      q: `What is the average price per sqft for ${type} in ${localityName}?`,
      a: `${cap(type)} ${dealLower} in ${localityName} average ${perSqft(avg)}, based on ${perSqftValues.length} current listings on DM Global.`,
    });
  }

  // 5) Top / most active developers.
  const devCounts = new Map<string, number>();
  for (const d of developments) {
    if (d.developerName) devCounts.set(d.developerName, (devCounts.get(d.developerName) ?? 0) + 1);
  }
  const topDevs = [...devCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  if (topDevs.length) {
    faqs.push({
      q: `Which developers build ${type} in ${localityName}?`,
      a: `${topDevs.length === 1 ? "The most active developer" : "The most active developers"} in ${localityName} ${topDevs.length === 1 ? "is" : "are"} ${joinAnd(topDevs)}, based on developments listed on DM Global.`,
    });
  }

  return compactFaqs(faqs);
}
