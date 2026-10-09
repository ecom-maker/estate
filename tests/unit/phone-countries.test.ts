import { describe, expect, it } from "vitest";
import { findCountry, flagEmoji, searchCountries, toE164 } from "@/lib/phone/countries";

describe("countries", () => {
  it("finds and flags countries", () => {
    expect(findCountry("ae")?.dial).toBe("971");
    expect(findCountry("IN")?.name).toBe("India");
    expect(flagEmoji("AE")).toBe("🇦🇪");
  });

  it("searches by name or dial code", () => {
    expect(searchCountries("united").map((c) => c.iso)).toEqual(["AE", "GB", "US"]);
    expect(searchCountries("+91").map((c) => c.iso)).toContain("IN");
    expect(searchCountries("971")[0].iso).toBe("AE");
  });

  it("builds E.164 numbers from what people type", () => {
    const ae = findCountry("AE")!;
    expect(toE164(ae, "050 123 4567")).toBe("+971501234567");
    expect(toE164(ae, "50-123-4567")).toBe("+971501234567");
    expect(toE164(ae, "+971 50 123 4567")).toBe("+971501234567");
    expect(toE164(findCountry("IN")!, "98765 43210")).toBe("+919876543210");
    expect(toE164(ae, "")).toBe("");
  });
});
