import { describe, expect, it } from "vitest";
import { computeNearby, formatKm, storedNearby } from "@/lib/property/nearby";

describe("computeNearby", () => {
  it("lists the nearest Dubai landmarks first", () => {
    // JBR / Dubai Marina
    const r = computeNearby(25.0785, 55.1345);
    expect(r).toHaveLength(5);
    expect(r[0].name).toBe("Dubai Marina");
    expect(r[0].km).toBeLessThan(1);
    expect(r.map((x) => x.km)).toEqual([...r.map((x) => x.km)].sort((a, b) => a - b));
  });

  it("puts DXB about 7 km from Downtown", () => {
    const dxb = computeNearby(25.1972, 55.2744).find((x) => x.name.includes("DXB"));
    expect(dxb?.km).toBeGreaterThan(6);
    expect(dxb?.km).toBeLessThan(13);
  });

  it("returns nothing without usable coordinates or outside Dubai", () => {
    expect(computeNearby(null, 55.2)).toEqual([]);
    expect(computeNearby(0, 0)).toEqual([]);
    expect(computeNearby(24.4539, 54.3773)).toEqual([]); // Abu Dhabi
  });
});

describe("storedNearby / formatKm", () => {
  it("accepts only a well-formed list", () => {
    expect(storedNearby({ nearby: [{ name: "A", km: 2 }] })).toEqual([{ name: "A", km: 2 }]);
    expect(storedNearby({ nearby: "x" })).toBeNull();
    expect(storedNearby(null)).toBeNull();
  });

  it("formats distances", () => {
    expect(formatKm(0.4)).toBe("Under 1 km");
    expect(formatKm(4.25)).toBe("4.3 km");
    expect(formatKm(23.6)).toBe("24 km");
  });
});
