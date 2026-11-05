import { describe, expect, it } from "vitest";
import { countryWhere, mergeCountryCounts } from "@/lib/property/country-filter";

describe("country filter", () => {
  it("counts blank country as UAE in one button", () => {
    expect(
      mergeCountryCounts([
        { country: "AE", count: 64 },
        { country: null, count: 29 },
        { country: "ID", count: 84 },
      ]),
    ).toEqual([
      { code: "AE", count: 93 },
      { code: "ID", count: 84 },
    ]);
  });

  it("UAE filter includes listings with no country; others are exact", () => {
    expect(countryWhere("ae")).toEqual({ OR: [{ country: "AE" }, { country: null }] });
    expect(countryWhere("ID")).toEqual({ country: "ID" });
  });
});
