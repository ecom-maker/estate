import { describe, expect, it } from "vitest";
import { describeIntent, intentToUnitWhere, mentionedProjects } from "@/lib/search/intent-units";

describe("intentToUnitWhere", () => {
  it("maps types, beds, price and status", () => {
    const where = intentToUnitWhere({
      propertyType: "penthouse",
      bedrooms: 3,
      maxPriceAED: 5_000_000,
      offPlan: true,
    });
    expect(where).toEqual([
      {
        OR: [
          { unitType: { in: ["PENTHOUSE"] } },
          { unitType: null, property: { type: { in: ["PENTHOUSE"] } } },
        ],
      },
      { bedrooms: { in: [3] } },
      { priceAed: { lte: 5_000_000 } },
      { property: { offPlan: true } },
    ]);
  });

  it("prefers named projects over the area", () => {
    expect(intentToUnitWhere({ community: "JVC" }, ["p1"])).toEqual([{ propertyId: { in: ["p1"] } }]);
    expect(intentToUnitWhere({ community: "JVC" })[0]).toHaveProperty("property.OR");
  });

  it("is empty for an empty intent", () => {
    expect(intentToUnitWhere({})).toEqual([]);
  });
});

describe("describeIntent", () => {
  it("summarises what was understood", () => {
    expect(
      describeIntent({ community: "Dubai Marina", propertyTypes: ["penthouse"], bedroomsList: [0, 2], maxPriceAED: 3_500_000, ready: true }),
    ).toEqual(["Dubai Marina", "Penthouse", "Studio / 2 Bed", "Under AED 3.5M", "Ready"]);
  });
});

describe("mentionedProjects", () => {
  const projects = [{ title: "Lume Residences" }, { title: "Bayz 102" }, { title: "LIV" }];
  it("finds whole project names in the query", () => {
    expect(mentionedProjects("2 bed in lume residences please", projects)).toEqual([{ title: "Lume Residences" }]);
    expect(mentionedProjects("bayz 102", projects)).toEqual([{ title: "Bayz 102" }]);
    expect(mentionedProjects("lively area", projects)).toEqual([]);
  });
});
