import { describe, expect, it } from "vitest";
import { resolveSkillCall, textRoute } from "@/lib/agents/a2a";
import { agentCard, AGENT_SKILLS } from "@/lib/agents/card";

describe("resolveSkillCall", () => {
  it("uses an explicit skill from a data part", () => {
    const call = resolveSkillCall({
      parts: [{ kind: "data", data: { skill: "market-insights", params: { community: "Dubai Marina", bedrooms: 2 } } }],
    });
    expect(call).toEqual({ skill: "market-insights", params: { community: "Dubai Marina", bedrooms: "2" }, text: null });
  });

  it("routes plain text by keywords, defaulting to search", () => {
    expect(resolveSkillCall({ parts: [{ kind: "text", text: "2 bed in Dubai Marina under 3M" }] })?.skill).toBe("property-search");
    expect(textRoute("price trends in JVC")).toBe("market-insights");
    expect(textRoute("latest off-plan launches")).toBe("project-search");
    expect(textRoute("what's new this week?")).toBe("latest-updates");
    expect(textRoute("which developers do you cover")).toBe("developer-profiles");
    expect(textRoute("what can you do")).toBe("agent-directory");
  });

  it("ignores unknown skills and empty messages", () => {
    expect(resolveSkillCall({ parts: [{ kind: "data", data: { skill: "delete-everything" } }] })?.skill).toBe("property-search");
    expect(resolveSkillCall({ parts: [] })).toBeNull();
    expect(resolveSkillCall(undefined)).toBeNull();
  });
});

describe("agentCard", () => {
  it("is an A2A card listing every skill and the JSON-RPC endpoint", () => {
    const card = agentCard();
    expect(card.url).toMatch(/\/api\/a2a$/);
    expect(card.preferredTransport).toBe("JSONRPC");
    expect(card.skills.map((s) => s.id)).toEqual(AGENT_SKILLS.map((s) => s.id));
    for (const s of card.skills) expect(s.description.length).toBeGreaterThan(20);
  });
});
