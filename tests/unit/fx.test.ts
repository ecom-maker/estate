import { describe, it, expect } from "vitest";
import { toAed, formatMoney } from "@/lib/currency/fx";

describe("toAed", () => {
  it("returns the same amount for AED", () => {
    expect(toAed(1_000_000, "AED")).toBe(1_000_000);
  });
  it("converts GBP to AED via the snapshot rate", () => {
    // 450,000 * 4.65 = 2,092,500
    expect(toAed(450_000, "GBP")).toBe(2_092_500);
  });
  it("is case-insensitive and falls back to 1 for unknown codes", () => {
    expect(toAed(100, "usd")).toBe(367); // 100 * 3.6725 ≈ 367
    expect(toAed(100, "ZZZ")).toBe(100);
  });
});

describe("formatMoney", () => {
  it("formats AED", () => {
    expect(formatMoney(2_650_000, "AED")).toContain("2,650,000");
  });
  it("formats GBP with its symbol", () => {
    expect(formatMoney(450_000, "GBP")).toContain("£");
  });
  it("handles null", () => {
    expect(formatMoney(null)).toBe("Price on request");
  });
});
