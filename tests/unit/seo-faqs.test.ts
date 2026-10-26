import { describe, expect, it } from "vitest";
import { buildProjectFaqs } from "@/lib/seo/project-faqs";
import { buildUnitFaqs } from "@/lib/seo/unit-faqs";
import { buildListingFaqs } from "@/lib/seo/listing-faqs";
import { parseListingSlug } from "@/lib/seo/listing-slug";
import type { Faq } from "@/lib/seo/faq";

/** The core invariant: never render an empty question or answer. */
function noEmpty(faqs: Faq[]) {
  for (const f of faqs) {
    expect(f.q.trim().length).toBeGreaterThan(0);
    expect(f.a.trim().length).toBeGreaterThan(0);
  }
}

describe("buildProjectFaqs", () => {
  it("renders no questions when every source field is missing", () => {
    const faqs = buildProjectFaqs({ title: "Empty Tower", offPlan: true });
    expect(faqs).toEqual([]);
  });

  it("omits only the questions whose source field is null", () => {
    // Has a price and a developer, but nothing else.
    const faqs = buildProjectFaqs({
      title: "Sparse Tower",
      offPlan: false,
      startingPriceAed: 1_250_000,
      developerName: "Emaar",
      handoverLabel: null,
      paymentPlan: null,
      unitLayouts: [],
      schools: [],
      hospitals: [],
      transactionCount: null,
      avgPerSqft: null,
    });
    const qs = faqs.map((f) => f.q);
    expect(qs).toContain("What is the starting price at Sparse Tower?");
    expect(qs).toContain("Who is the developer of Sparse Tower?");
    expect(qs.some((q) => q.includes("hand over"))).toBe(false);
    expect(qs.some((q) => q.includes("payment plan"))).toBe(false);
    expect(qs.some((q) => q.includes("schools and hospitals"))).toBe(false);
    noEmpty(faqs);
  });

  it("generates 5-7 fact-first answers when fully populated", () => {
    const faqs = buildProjectFaqs({
      title: "Iconic Tower",
      offPlan: true,
      startingPriceAed: 799_289,
      developerName: "MERED",
      handoverLabel: "Sept 2027",
      paymentPlan: { downPaymentPct: 20, onHandoverPct: 80 },
      unitLayouts: ["Studio", "1 Bed", "2 Bed"],
      schools: [{ name: "GEMS School", km: 2.1 }],
      hospitals: [{ name: "Medcare Hospital", km: 3.4 }],
      transactionCount: 6,
      avgPerSqft: 2648,
      trendDirection: "rising",
      comparablesLabel: "2 bedroom in Downtown Dubai",
    });
    expect(faqs.length).toBeGreaterThanOrEqual(5);
    expect(faqs.length).toBeLessThanOrEqual(7);
    noEmpty(faqs);
    const byq = Object.fromEntries(faqs.map((f) => [f.q, f.a]));
    expect(byq["What is the starting price at Iconic Tower?"]).toContain("799,289");
    expect(byq["Does Iconic Tower have a payment plan?"]).toContain("20% down payment");
    expect(byq["When does Iconic Tower hand over?"]).toContain("Sept 2027");
    expect(byq["Who is the developer of Iconic Tower?"]).toContain("MERED");
    expect(byq["What schools and hospitals are near Iconic Tower?"]).toContain("2.1 km");
    expect(byq["What are recent sale prices near Iconic Tower?"]).toContain("AED 2,648/sqft");
  });

  it("omits the transactions question below the minimum sample size", () => {
    const faqs = buildProjectFaqs({
      title: "Thin Data Tower",
      offPlan: true,
      transactionCount: 2, // < 3 minimum
      avgPerSqft: 2000,
    });
    expect(faqs.some((f) => f.q.includes("recent sale prices"))).toBe(false);
  });
});

describe("buildUnitFaqs", () => {
  it("renders nothing when sources are null and unit is sale-only", () => {
    const faqs = buildUnitFaqs({
      projectTitle: "Iconic Tower",
      pricePerSqft: null,
      avgPerSqft: null,
      paymentPlan: null,
      listing: "sale",
      rentPriceAed: null,
    });
    expect(faqs).toEqual([]);
  });

  it("caps at 3 and states the per-sqft delta and rent", () => {
    const faqs = buildUnitFaqs({
      projectTitle: "Iconic Tower",
      pricePerSqft: 3184,
      avgPerSqft: 2648,
      avgScopeLabel: "Downtown Dubai",
      paymentPlan: { downPaymentPct: 20, onHandoverPct: 80 },
      listing: "both",
      rentPriceAed: 120_000,
    });
    expect(faqs.length).toBeLessThanOrEqual(3);
    noEmpty(faqs);
    const joined = faqs.map((f) => f.a).join(" | ");
    expect(joined).toContain("3,184/sqft");
    expect(joined).toMatch(/\d+% above the Downtown Dubai average/);
    expect(joined).toContain("120,000 per year");
  });

  it("omits the rent question for sale-only units", () => {
    const faqs = buildUnitFaqs({
      projectTitle: "Iconic Tower",
      pricePerSqft: 3184,
      avgPerSqft: 2648,
      listing: "sale",
    });
    expect(faqs.some((f) => f.q.includes("available to rent"))).toBe(false);
  });
});

describe("buildListingFaqs", () => {
  const parsed = parseListingSlug("apartments-for-sale-in-ajman")!;

  it("renders nothing with no inventory", () => {
    const faqs = buildListingFaqs({
      parsed,
      localityName: "Ajman",
      units: [],
      developments: [],
    });
    expect(faqs).toEqual([]);
  });

  it("produces aggregated answers from real data", () => {
    const faqs = buildListingFaqs({
      parsed,
      localityName: "Ajman",
      units: [
        { priceAed: 690_000, areaSqft: 800, property: { title: "Glam Residence" } },
        { priceAed: 820_000, areaSqft: 950, property: { title: "Ajman Creek Towers" } },
        { priceAed: 1_100_000, areaSqft: 1200, property: { title: "Ajman Creek Towers" } },
      ],
      developments: [
        { title: "Ajman Creek Towers", priceAed: 820_000, offPlan: true, developerName: "Aldar" },
        { title: "Glam Residence", priceAed: 690_000, offPlan: false, developerName: "Tiger" },
      ],
    });
    noEmpty(faqs);
    const qs = faqs.map((f) => f.q);
    expect(qs.some((q) => q.includes("off-plan vs completed"))).toBe(true);
    expect(qs.some((q) => q.includes("average price per sqft"))).toBe(true);
    expect(qs.some((q) => q.includes("price range"))).toBe(true);
    expect(qs.some((q) => q.includes("Which developers build"))).toBe(true);
    expect(faqs.length).toBeLessThanOrEqual(5);
  });
});
