import { describe, expect, it } from "vitest";
import { dldScopeFor, projectNameCandidates } from "@/lib/property/dld-communities";

describe("dldScopeFor", () => {
  it("matches across bracket order, case and &/and", () => {
    expect(dldScopeFor("JVC (Jumeirah Village Circle)")).toEqual({ labels: ["Jumeirah Village Circle (JVC)"] });
    expect(dldScopeFor("Damac Islands")).toEqual({ labels: ["DAMAC Islands"] });
    expect(dldScopeFor("The Heights Country Club & Wellness")).toEqual({
      labels: ["The Heights Country Club and Wellness"],
    });
    expect(dldScopeFor("Dubai Creek Harbour (The Lagoons)")).toEqual({ labels: ["Dubai Creek Harbour"] });
  });

  it("prefers an exact name over bracket aliases", () => {
    expect(dldScopeFor("Dubai Marina")).toEqual({ labels: ["Dubai Marina"] });
    expect(dldScopeFor("Business Bay")).toEqual({ labels: ["Business Bay"] });
  });

  it("uses overrides for names spelled differently in DLD", () => {
    expect(dldScopeFor("The Valley")).toEqual({ labels: ["The Valley by Emaar"] });
    expect(dldScopeFor("MBR District 11 (Meydan South)")?.sub).toBe("District 11");
    expect(dldScopeFor("Dubai Investment Park (DIP)")?.labels).toHaveLength(2);
  });

  it("returns null outside the Dubai data", () => {
    expect(dldScopeFor("Abu Dhabi")).toBeNull();
    expect(dldScopeFor("Canggu")).toBeNull();
    expect(dldScopeFor(null)).toBeNull();
  });
});

describe("projectNameCandidates", () => {
  it("includes the short DLD cluster name", () => {
    const c = projectNameCandidates("Salva The Heights");
    expect(c).toContain("Salva");
    expect(c).toContain("Salva The Heights");
  });

  it("drops developer suffixes and generic single words", () => {
    const c = projectNameCandidates("The Archive by Imtiaz");
    expect(c).toContain("The Archive");
    expect(c).not.toContain("The");
    expect(projectNameCandidates("Golf Hills")).not.toContain("Hills");
  });
});
