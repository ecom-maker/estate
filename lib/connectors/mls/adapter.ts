import type { Connector, NormalizedProperty } from "@/lib/connectors/types";

type MlsRaw = {
  listingId: string;
  headline: string;
  listPrice: number;
  propertyClass: string;
  bedCount: number;
  bathCount: number;
  livingArea: number;
  subdivision: string;
};

const MLS_FIXTURE: MlsRaw[] = [
  {
    listingId: "mls-1001",
    headline: "Emirates Hills Estate Home",
    listPrice: 45000000,
    propertyClass: "villa",
    bedCount: 6,
    bathCount: 7,
    livingArea: 14000,
    subdivision: "Emirates Hills",
  },
];

export class MockMLSAdapter implements Connector<MlsRaw> {
  name = "Mock MLS";
  type = "MLS" as const;

  async fetchPage(page: number) {
    return page === 1 ? MLS_FIXTURE : [];
  }

  normalize(raw: MlsRaw): NormalizedProperty {
    return {
      externalId: raw.listingId,
      source: "mls-mock",
      title: raw.headline,
      propertyType: raw.propertyClass,
      priceAED: raw.listPrice,
      bedrooms: raw.bedCount,
      bathrooms: raw.bathCount,
      areaSqft: raw.livingArea,
      community: raw.subdivision,
    };
  }
}
