import { formatAED } from "@/lib/utils";
import { type Faq, perSqft, joinAnd, compactFaqs } from "@/lib/seo/faq";

type PaymentPlan = {
  downPaymentPct?: number | null;
  duringConstructionPct?: number | null;
  onHandoverPct?: number | null;
} | null;

/**
 * Up to 3 unit-specific FAQs: price per sqft vs the building/area average,
 * payment plan, and rent availability. Null sources are omitted.
 */
export function buildUnitFaqs(args: {
  projectTitle: string;
  pricePerSqft?: number | null;
  avgPerSqft?: number | null;
  /** How the average is scoped, e.g. "this building" or "Downtown Dubai". */
  avgScopeLabel?: string | null;
  paymentPlan?: PaymentPlan;
  /** Per-unit listing mode; rent question only shown when rent is offered. */
  listing?: "sale" | "rent" | "both" | null;
  rentPriceAed?: number | null;
}): Faq[] {
  const {
    projectTitle,
    pricePerSqft,
    avgPerSqft,
    avgScopeLabel,
    paymentPlan,
    listing,
    rentPriceAed,
  } = args;

  const faqs: Faq[] = [];

  // 1) Price per sqft vs building/area average.
  if (
    typeof pricePerSqft === "number" &&
    pricePerSqft > 0 &&
    typeof avgPerSqft === "number" &&
    avgPerSqft > 0
  ) {
    const diffPct = Math.round(((pricePerSqft - avgPerSqft) / avgPerSqft) * 100);
    const scope = avgScopeLabel ? ` the ${avgScopeLabel} average` : " the local average";
    const rel =
      diffPct === 0
        ? `in line with${scope}`
        : diffPct > 0
          ? `${diffPct}% above${scope}`
          : `${Math.abs(diffPct)}% below${scope}`;
    faqs.push({
      q: `How does this unit's price per sqft compare to the average?`,
      a: `This unit is priced at ${perSqft(pricePerSqft)}, ${rel} of ${perSqft(
        avgPerSqft,
      )}.`,
    });
  }

  // 2) Payment plan (from the project).
  const down = paymentPlan?.downPaymentPct;
  if (typeof down === "number") {
    const parts = [`${down}% down payment`];
    if (typeof paymentPlan?.duringConstructionPct === "number")
      parts.push(`${paymentPlan.duringConstructionPct}% during construction`);
    if (typeof paymentPlan?.onHandoverPct === "number")
      parts.push(`${paymentPlan.onHandoverPct}% on handover`);
    faqs.push({
      q: `Is a payment plan available for this unit?`,
      a: `Yes — ${projectTitle} offers a payment plan of ${joinAnd(parts)}.`,
    });
  }

  // 3) Rent availability (only when the unit is offered for rent).
  if (listing === "rent" || listing === "both") {
    faqs.push({
      q: `Is this unit available to rent?`,
      a:
        typeof rentPriceAed === "number" && rentPriceAed > 0
          ? `Yes — this unit is available to rent at ${formatAED(rentPriceAed)} per year.`
          : `Yes — this unit is available to rent; the annual rent is available on request.`,
    });
  }

  return compactFaqs(faqs).slice(0, 3);
}
