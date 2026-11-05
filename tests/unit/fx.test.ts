import { describe, it, expect } from "vitest";
import { toAed, formatMoney, formatUnitPrice } from "@/lib/currency/fx";

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
  it("labels other currencies with their code", () => {
    expect(formatMoney(450_000, "GBP")).toMatch(/^GBP\s450,000$/);
    expect(formatMoney(748_000, "USD")).toMatch(/^USD\s748,000$/);
  });
  it("keeps AED as before", () => {
    expect(formatMoney(2_650_000, "AED")).toMatch(/^AED\s2,650,000$/);
  });
  it("handles null", () => {
    expect(formatMoney(null)).toBe("Price on request");
  });
});

describe("formatUnitPrice", () => {
  it("shows a USD listing's AED-stored unit price back in USD", () => {
    // Bali import stores round(748,000 x 3.6725) = 2,747,030 AED
    expect(formatUnitPrice(2_747_030, "USD")).toMatch(/^USD\s748,000$/);
  });
  it("leaves AED listings unchanged", () => {
    expect(formatUnitPrice(1_200_000, "AED")).toMatch(/^AED\s1,200,000$/);
    expect(formatUnitPrice(1_200_000, null)).toMatch(/^AED\s1,200,000$/);
    expect(formatUnitPrice(null, "USD")).toBe("Price on request");
  });
});
