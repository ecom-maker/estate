import { formatMoney } from "@/lib/currency/fx";
import { type Faq, perSqft, joinAnd, compactFaqs } from "@/lib/seo/faq";

type Nearby = { name: string; km: number };
type PaymentPlan = {
  downPaymentPct?: number | null;
  duringConstructionPct?: number | null;
  onHandoverPct?: number | null;
} | null;

/**
 * 5–7 FAQs for a project (development) page, generated from DB fields.
 * Every answer leads with the concrete fact (and its number). Any question
 * whose source field is null/empty is omitted — see compactFaqs + the guards.
 */
export function buildProjectFaqs(args: {
  title: string;
  offPlan: boolean;
  startingPriceAed?: number | null;
  /** Native starting price + currency for display (falls back to AED). */
  startingPrice?: number | null;
  currency?: string;
  developerName?: string | null;
  handoverLabel?: string | null; // e.g. "Sept 2027"
  paymentPlan?: PaymentPlan;
  /** Visible layout labels, e.g. ["Studio", "1 Bed", "2 Bed"]. */
  unitLayouts?: string[];
  schools?: Nearby[];
  hospitals?: Nearby[];
  /** Recorded comparable transactions near the project. */
  transactionCount?: number | null;
  avgPerSqft?: number | null;
  trendDirection?: "rising" | "softening" | "stable" | null;
  comparablesLabel?: string | null; // e.g. "2 bedroom in Downtown Dubai"
}): Faq[] {
  const {
    title,
    offPlan,
    startingPriceAed,
    startingPrice,
    currency = "AED",
    developerName,
    handoverLabel,
    paymentPlan,
    unitLayouts = [],
    schools = [],
    hospitals = [],
    transactionCount,
    avgPerSqft,
    trendDirection,
    comparablesLabel,
  } = args;

  const faqs: Faq[] = [];

  // 1) Starting price.
  if (typeof startingPriceAed === "number" && startingPriceAed > 0) {
    faqs.push({
      q: `What is the starting price at ${title}?`,
      a: `Prices at ${title} start from ${formatMoney(
        startingPrice ?? startingPriceAed,
        currency,
      )}${
        offPlan ? ", on an off-plan basis" : ""
      }. This is the lowest current list price across available units.`,
    });
  }

  // 2) Payment plan.
  const down = paymentPlan?.downPaymentPct;
  if (typeof down === "number") {
    const parts = [`${down}% down payment`];
    if (typeof paymentPlan?.duringConstructionPct === "number")
      parts.push(`${paymentPlan.duringConstructionPct}% during construction`);
    if (typeof paymentPlan?.onHandoverPct === "number")
      parts.push(`${paymentPlan.onHandoverPct}% on handover`);
    faqs.push({
      q: `Does ${title} have a payment plan?`,
      a: `Yes — ${title} offers a payment plan of ${joinAnd(parts)}.`,
    });
  }

  // 3) Handover.
  if (handoverLabel) {
    faqs.push({
      q: `When does ${title} hand over?`,
      a: `${title} is scheduled for handover in ${handoverLabel}.`,
    });
  }

  // 4) Developer.
  if (developerName) {
    faqs.push({
      q: `Who is the developer of ${title}?`,
      a: `${title} is developed by ${developerName}.`,
    });
  }

  // 5) Unit types & bed counts.
  if (unitLayouts.length) {
    faqs.push({
      q: `What unit types are available at ${title}?`,
      a: `${title} offers ${unitLayouts.length} layout${
        unitLayouts.length === 1 ? "" : "s"
      }: ${joinAnd(unitLayouts)}.`,
    });
  }

  // 6) Nearby schools & hospitals with distances.
  const school = schools[0];
  const hospital = hospitals[0];
  if (school || hospital) {
    const bits: string[] = [];
    if (school)
      bits.push(`the nearest school is ${school.name} (${school.km} km away)`);
    if (hospital)
      bits.push(
        `the nearest hospital is ${hospital.name} (${hospital.km} km away)`,
      );
    faqs.push({
      q: `What schools and hospitals are near ${title}?`,
      a: `From ${title}, ${bits.join("; ")}.`,
    });
  }

  // 7) Transaction activity & price trend.
  if (
    typeof transactionCount === "number" &&
    transactionCount >= 3 &&
    typeof avgPerSqft === "number" &&
    avgPerSqft > 0
  ) {
    const scope = comparablesLabel ? ` for ${comparablesLabel}` : "";
    const trend = trendDirection
      ? trendDirection === "stable"
        ? ", with prices broadly stable"
        : `, with prices ${trendDirection}`
      : "";
    faqs.push({
      q: `What are recent sale prices near ${title}?`,
      a: `${transactionCount} comparable transactions${scope} are recorded on DM Global, averaging ${perSqft(
        avgPerSqft,
      )}${trend}.`,
    });
  }

  return compactFaqs(faqs);
}
