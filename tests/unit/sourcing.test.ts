import { describe, expect, it } from "vitest";
import { requirementLines, sourcingSchema } from "@/lib/agents/sourcing";
import { resolveSkillCall, textRoute } from "@/lib/agents/a2a";

describe("sourcingSchema", () => {
  it("accepts contact + a requirement, coercing the strings agents send", () => {
    const r = sourcingSchema.parse({
      name: "Jane Doe",
      phone: "+971 50 123 4567",
      community: "Palm Jumeirah",
      bedrooms: "5",
      maxBudgetAed: "30000000",
      offPlan: "false",
    });
    expect(r.bedrooms).toBe(5);
    expect(r.offPlan).toBe(false);
    expect(requirementLines(r)).toEqual([
      "Area: Palm Jumeirah",
      "Bedrooms: 5",
      "Budget: up to AED 30,000,000",
      "Status: Ready",
    ]);
  });

  it("needs a name, a usable phone or email, and at least one requirement", () => {
    const msgs = (v: unknown) => {
      const r = sourcingSchema.safeParse(v);
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    expect(msgs({ name: "Jane", community: "JVC" }).join()).toMatch(/phone number or an email/);
    expect(msgs({ name: "Jane", phone: "abc123", community: "JVC" }).join()).toMatch(/digits only/);
    expect(msgs({ name: "Jane", email: "jane@example.com" }).join()).toMatch(/at least one specific requirement/);
    expect(msgs({ name: "Jane", email: "jane@example.com", notes: "sea view penthouse" })).toEqual([]);
  });
});

describe("sourcing routing", () => {
  it("is reachable by skill id and by text", () => {
    expect(resolveSkillCall({ parts: [{ kind: "data", data: { skill: "sourcing-request", params: { name: "J" } } }] })?.skill).toBe(
      "sourcing-request",
    );
    expect(textRoute("can you source an off-market villa for us")).toBe("sourcing-request");
    expect(textRoute("market prices in JVC")).toBe("market-insights");
  });
});
