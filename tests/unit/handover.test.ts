import { describe, it, expect } from "vitest";
import {
  completionLabelOf,
  effectiveOffPlan,
  handoverOrCompletionLabel,
} from "@/lib/property/handover";

describe("handoverOrCompletionLabel", () => {
  it("prefers the exact handover date", () => {
    expect(
      handoverOrCompletionLabel({ handoverDate: "2026-06-30", completionLabel: "Q2 2026" }),
    ).toBe("Jun 2026");
  });

  it("falls back to the source's own label, word for word", () => {
    expect(handoverOrCompletionLabel({ completionLabel: "Q3 2026" })).toBe("Q3 2026");
    // A bare year must stay a year, never become "Jan 2024".
    expect(handoverOrCompletionLabel({ completionLabel: "2024" })).toBe("2024");
  });

  it("is null when neither is on file", () => {
    expect(handoverOrCompletionLabel({})).toBeNull();
    expect(handoverOrCompletionLabel(null)).toBeNull();
    expect(completionLabelOf({ completionLabel: "  " })).toBeNull();
  });
});

describe("effectiveOffPlan", () => {
  it("stays off-plan when handover is in the future", () => {
    expect(effectiveOffPlan(true, { handoverDate: "2099-01-01" })).toBe(true);
  });

  it("flips to completed when handover is in the past", () => {
    expect(effectiveOffPlan(true, { handoverDate: "2017-06-30" })).toBe(false);
  });

  it("keeps the flag when there is no handover date", () => {
    expect(effectiveOffPlan(true, {})).toBe(true);
    expect(effectiveOffPlan(true, null)).toBe(true);
  });

  it("keeps the flag when the handover date is unparseable", () => {
    expect(effectiveOffPlan(true, { handoverDate: "not-a-date" })).toBe(true);
  });

  it("never turns a completed project into off-plan", () => {
    expect(effectiveOffPlan(false, { handoverDate: "2099-01-01" })).toBe(false);
  });
});
