import { describe, it, expect } from "vitest";
import { effectiveOffPlan } from "@/lib/property/handover";

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
