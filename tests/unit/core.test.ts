import { describe, expect, it } from "vitest";
import { extractSearchIntentHeuristic } from "@/lib/ai/intent";
import { rankProperties } from "@/lib/search/ranking";
import { SearchIntentSchema } from "@/lib/validation/search-intent";
import { hasPermission } from "@/lib/rbac/check";
import { maskSecret } from "@/lib/utils";
import type { Property } from "@prisma/client";

describe("search intent heuristics", () => {
  it("extracts villa, bedrooms, budget, and waterfront", () => {
    const intent = extractSearchIntentHeuristic(
      "Find me a 5 bedroom waterfront villa in Palm Jumeirah under AED 30M",
    );
    expect(intent.propertyType).toBe("villa");
    expect(intent.bedrooms).toBe(5);
    expect(intent.waterfront).toBe(true);
    expect(intent.maxPriceAED).toBe(30_000_000);
    expect(intent.community).toMatch(/Palm Jumeirah/i);
  });

  it("merges follow-up only waterfront", () => {
    const first = extractSearchIntentHeuristic("Show me villas in Palm Jumeirah");
    const second = extractSearchIntentHeuristic("Only waterfront", first);
    expect(second.propertyType).toBe("villa");
    expect(second.waterfront).toBe(true);
  });
});

describe("SearchIntentSchema", () => {
  it("validates structured intent", () => {
    const parsed = SearchIntentSchema.parse({
      propertyType: "villa",
      maxPriceAED: 25000000,
      waterfront: true,
    });
    expect(parsed.propertyType).toBe("villa");
  });
});

describe("ranking", () => {
  it("scores waterfront matches higher", () => {
    const properties = [
      {
        id: "1",
        type: "VILLA",
        bedrooms: 5,
        priceAed: 20000000,
        waterfront: true,
        privateBeach: false,
        offPlan: false,
        status: "ACTIVE",
        description: "x",
      },
      {
        id: "2",
        type: "VILLA",
        bedrooms: 5,
        priceAed: 20000000,
        waterfront: false,
        privateBeach: false,
        offPlan: false,
        status: "ACTIVE",
        description: "x",
      },
    ] as Property[];

    const ranked = rankProperties(properties, {
      propertyType: "villa",
      bedrooms: 5,
      waterfront: true,
    });
    expect(ranked[0]?.id).toBe("1");
  });
});

describe("rbac", () => {
  it("allows super admin properties.delete", () => {
    expect(hasPermission(["SUPER_ADMIN"], "properties.delete")).toBe(true);
    expect(hasPermission(["AGENT"], "properties.delete")).toBe(false);
  });
});

describe("maskSecret", () => {
  it("masks secrets", () => {
    expect(maskSecret("sk-abcdefghijklmnop1234")).toContain("••••");
  });
});
