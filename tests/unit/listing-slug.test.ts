import { describe, expect, it } from "vitest";
import {
  parseListingSlug,
  buildListingSlug,
  humanizeSlug,
  listingTitle,
} from "@/lib/seo/listing-slug";

describe("listing slug taxonomy", () => {
  it("parses a canonical slug", () => {
    const parsed = parseListingSlug("flats-for-sale-in-palm-jumeirah");
    expect(parsed).not.toBeNull();
    expect(parsed!.typeToken).toBe("flats");
    expect(parsed!.deal).toBe("sale");
    expect(parsed!.localitySlug).toBe("palm-jumeirah");
    expect(parsed!.typeDef.enums).toContain("APARTMENT");
  });

  it("parses a multi-word locality and rent deal", () => {
    const parsed = parseListingSlug("villas-for-rent-in-pallavaram-radial-road");
    expect(parsed!.deal).toBe("rent");
    expect(parsed!.localitySlug).toBe("pallavaram-radial-road");
    expect(parsed!.typeDef.enums).toEqual(["VILLA"]);
  });

  it("rejects unknown property-type tokens", () => {
    expect(parseListingSlug("spaceships-for-sale-in-palm-jumeirah")).toBeNull();
  });

  it("rejects malformed slugs and real routes", () => {
    expect(parseListingSlug("properties")).toBeNull();
    expect(parseListingSlug("flats-in-palm-jumeirah")).toBeNull();
    expect(parseListingSlug("flats-for-lease-in-palm-jumeirah")).toBeNull();
    expect(parseListingSlug("search")).toBeNull();
  });

  it("round-trips build and parse", () => {
    const slug = buildListingSlug("penthouses", "sale", "downtown-dubai");
    expect(slug).toBe("penthouses-for-sale-in-downtown-dubai");
    expect(parseListingSlug(slug)!.deal).toBe("sale");
  });

  it("humanizes slugs and builds titles", () => {
    expect(humanizeSlug("pallavaram-radial-road")).toBe("Pallavaram Radial Road");
    const parsed = parseListingSlug("flats-for-sale-in-palm-jumeirah")!;
    expect(listingTitle(parsed, "Palm Jumeirah")).toBe("Flats for Sale in Palm Jumeirah");
  });
});
