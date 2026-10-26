import { describe, expect, it } from "vitest";
import { cleanPlaceName } from "@/lib/property/place-name";

describe("cleanPlaceName", () => {
  it("drops a practitioner listing down to the facility name", () => {
    expect(
      cleanPlaceName(
        "Dr Haitham Elsayed paediatric specialist ALZAHRA HOSPITAL DUBAI",
      ),
    ).toBe("Alzahra Hospital Dubai");
  });

  it("strips doctor + consultant/specialist leads before a clinic", () => {
    expect(
      cleanPlaceName("Dr Jane Smith consultant dermatologist NMC Royal Clinic"),
    ).toBe("NMC Royal Clinic");
  });

  it("keeps a facility that is genuinely named after a person", () => {
    // No clinical role word between "Dr" and the facility → left intact.
    expect(cleanPlaceName("Dr Sulaiman Al Habib Hospital")).toBe(
      "Dr Sulaiman Al Habib Hospital",
    );
  });

  it("title-cases shouty ALL-CAPS names but keeps known acronyms", () => {
    expect(cleanPlaceName("MEDCARE HOSPITAL")).toBe("Medcare Hospital");
    expect(cleanPlaceName("GEMS WELLINGTON ACADEMY")).toBe(
      "GEMS Wellington Academy",
    );
  });

  it("leaves correctly-cased names unchanged", () => {
    expect(cleanPlaceName("Dubai American Academy")).toBe(
      "Dubai American Academy",
    );
    expect(cleanPlaceName("Mall of the Emirates")).toBe("Mall of the Emirates");
  });

  it("handles empty / nullish input", () => {
    expect(cleanPlaceName("")).toBe("");
    expect(cleanPlaceName(null)).toBe("");
    expect(cleanPlaceName(undefined)).toBe("");
    expect(cleanPlaceName("  Clinic   Name  ")).toBe("Clinic Name");
  });
});
