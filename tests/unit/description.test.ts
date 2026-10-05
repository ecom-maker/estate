import { describe, expect, it } from "vitest";
import { descriptionSections, metaDescription, splitDescription } from "@/lib/property/description";

const REELLY =
  "Project general facts\n\nGlam Residence offers studios to three-bedroom apartments.\n\nPremium finishes throughout.\n" +
  "Finishing and materials\n\nModern finishing.\nKitchen and appliances\n\nEquipped kitchen.\n" +
  "Furnishing\n\nSemi-furnished\nLocation description and benefits\n\nAl Zorah is close to Dubai.";

describe("splitDescription", () => {
  it("splits a Reelly description by its headings, About and Location first", () => {
    const s = splitDescription(REELLY);
    expect(s.map((x) => x.key)).toEqual(["about", "location", "finishes", "kitchen", "furnishing"]);
    expect(s[0].paragraphs).toEqual([
      "Glam Residence offers studios to three-bedroom apartments.",
      "Premium finishes throughout.",
    ]);
    expect(s[1]).toMatchObject({ heading: "Location", paragraphs: ["Al Zorah is close to Dubai."] });
  });

  it("treats a description without headings as one About section", () => {
    expect(splitDescription("A villa.\nWith a pool.")).toEqual([
      { key: "about", heading: "About the project", paragraphs: ["A villa.", "With a pool."] },
    ]);
  });

  it("ignores empty and seed text", () => {
    expect(splitDescription(null)).toEqual([]);
    expect(splitDescription("SEED DATA - demo")).toEqual([]);
  });

  it("prefers stored sections and falls back to splitting", () => {
    const stored = [{ key: "about", heading: "About the project", paragraphs: ["Stored."] }];
    expect(descriptionSections({ description: REELLY, descriptionSections: stored })).toEqual(stored);
    expect(descriptionSections({ description: REELLY, descriptionSections: null })[0].key).toBe("about");
  });

  it("builds meta text from the summary, else the first paragraph, never the heading", () => {
    expect(metaDescription({ summary: "Short summary.", description: REELLY })).toBe("Short summary.");
    expect(metaDescription({ description: REELLY })).toMatch(/^Glam Residence offers/);
  });
});
