import { describe, expect, it } from "vitest";
import { inferUnitType, projectListsType, typeFromText } from "@/lib/property/unit-type";

const tower = { type: "APARTMENT" as const, metadata: { unitTypes: ["Apartments", "Penthouse"] } };

describe("typeFromText", () => {
  it("maps feed wording to types", () => {
    expect(typeFromText("Penthouses")).toBe("PENTHOUSE");
    expect(typeFromText("Penthouse Apartment")).toBe("PENTHOUSE");
    expect(typeFromText("Hotel Apartment")).toBe("UNIT");
    expect(typeFromText("Townhouse Villa")).toBe("TOWNHOUSE");
    expect(typeFromText("Duplex")).toBe("APARTMENT");
    expect(typeFromText("Villas")).toBe("VILLA");
    expect(typeFromText("1BR-21")).toBeNull();
    expect(typeFromText(42)).toBeNull();
  });
});

describe("inferUnitType", () => {
  it("prefers the unit's own feed type", () => {
    expect(inferUnitType({ unitNumber: "4BR-1", metadata: { unit_type: "Penthouse" } }, tower)).toEqual({
      type: "PENTHOUSE",
      source: "unit-feed",
    });
  });

  it("reads clear words in the unit name", () => {
    expect(inferUnitType({ unitNumber: "PH-01", metadata: null }, tower)).toEqual({
      type: "PENTHOUSE",
      source: "unit-name",
    });
  });

  it("leaves tower units unknown when the project lists several types", () => {
    expect(inferUnitType({ unitNumber: "1BR-21", metadata: {} }, tower)).toBeNull();
    expect(inferUnitType({ unitNumber: "Studio-3", metadata: {} }, tower)).toBeNull();
  });

  it("falls back to the project", () => {
    expect(inferUnitType({ unitNumber: "4BR", metadata: {} }, { type: "VILLA", metadata: {} })).toEqual({
      type: "VILLA",
      source: "project",
    });
    expect(
      inferUnitType({ unitNumber: "2BR", metadata: {} }, { type: "APARTMENT", metadata: { unitTypes: ["Apartments"] } }),
    ).toEqual({ type: "APARTMENT", source: "project" });
  });

  it("knows which projects list a type", () => {
    expect(projectListsType(tower.metadata, "PENTHOUSE")).toBe(true);
    expect(projectListsType({}, "PENTHOUSE")).toBe(false);
  });
});
