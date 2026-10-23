import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  parseUnitFilters,
  unitFiltersToSearch,
  unitFiltersWhere,
} from "@/lib/search/unit-filters";

describe("unit filters", () => {
  it("round-trips through the URL", () => {
    const f = {
      q: "JVC",
      types: ["Apartment", "Villa"],
      beds: ["studio", "7+"],
      baths: ["2"],
      min: "500000",
      max: "1,200,000",
      status: "offplan" as const,
      furnishing: "furnished" as const,
    };
    const parsed = parseUnitFilters(Object.fromEntries(new URLSearchParams(unitFiltersToSearch(f))));
    expect(parsed).toEqual({ ...f, max: "1200000" });
  });

  it("drops unknown values and supports old bed links", () => {
    expect(parseUnitFilters({ type: "Castle", beds: "9", status: "x" })).toEqual(EMPTY_FILTERS);
    expect(parseUnitFilters({ beds: "0" }).beds).toEqual(["studio"]);
    expect(parseUnitFilters({ beds: "4" }).beds).toContain("7+");
  });

  it("builds the query", () => {
    const where = unitFiltersWhere({
      ...EMPTY_FILTERS,
      types: ["Compound", "Bungalow"],
      beds: ["studio", "7+"],
      min: "100",
      status: "ready",
    });
    expect(where).toEqual([
      {
        OR: [
          { unitType: { in: ["VILLA"] } },
          { unitType: null, property: { type: { in: ["VILLA"] } } },
        ],
      },
      { OR: [{ bedrooms: 0 }, { bedrooms: { gte: 7 } }] },
      { priceAed: { gte: 100 } },
      { property: { offPlan: false } },
    ]);
    expect(unitFiltersWhere(EMPTY_FILTERS)).toEqual([]);
  });

  it("maps furnishing to the project's furnished flag / metadata", () => {
    expect(unitFiltersWhere({ ...EMPTY_FILTERS, furnishing: "furnished" })).toEqual([
      { property: { furnished: true } },
    ]);
    expect(unitFiltersWhere({ ...EMPTY_FILTERS, furnishing: "unfurnished" })).toEqual([
      { property: { furnished: false } },
    ]);
    expect(unitFiltersWhere({ ...EMPTY_FILTERS, furnishing: "partly" })).toEqual([
      { property: { metadata: { path: ["furnishing"], string_contains: "semi" } } },
    ]);
  });
});
