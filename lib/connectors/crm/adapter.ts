import type { Connector, NormalizedProperty } from "@/lib/connectors/types";
import fixture from "@/lib/connectors/fixtures/crm-properties.json";

type CrmRaw = (typeof fixture)[number];

export class MockCRMAdapter implements Connector<CrmRaw> {
  name = "Mock CRM";
  type = "CRM" as const;

  async fetchPage(page: number) {
    if (page > 1) return [];
    return fixture as CrmRaw[];
  }

  normalize(raw: CrmRaw): NormalizedProperty {
    return {
      externalId: raw.id,
      source: "crm-mock",
      title: raw.name,
      description: raw.desc,
      propertyType: raw.type.toLowerCase(),
      priceAED: raw.price,
      bedrooms: raw.beds,
      bathrooms: raw.baths,
      areaSqft: raw.area,
      latitude: raw.lat,
      longitude: raw.lng,
      community: raw.community,
      developer: raw.developer,
      waterfront: raw.waterfront,
      privateBeach: "private_beach" in raw ? Boolean(raw.private_beach) : false,
      images: raw.images,
      amenities: raw.amenities,
    };
  }
}
