import type { Property } from "@prisma/client";
import type { SearchIntent } from "@/lib/validation/search-intent";

export function rankProperties<T extends Property>(
  properties: T[],
  intent: SearchIntent,
): Array<T & { score: number }> {
  return properties
    .map((property) => {
      let score = 0;
      if (
        intent.propertyType &&
        property.type.toLowerCase() === intent.propertyType
      ) {
        score += 25;
      }
      if (intent.bedrooms != null && property.bedrooms === intent.bedrooms) {
        score += 15;
      }
      if (
        intent.maxPriceAED != null &&
        property.priceAed != null &&
        property.priceAed <= intent.maxPriceAED
      ) {
        score += 15;
      }
      if (intent.waterfront && property.waterfront) score += 20;
      if (intent.privateBeach && property.privateBeach) score += 10;
      if (intent.offPlan != null && property.offPlan === intent.offPlan) {
        score += 5;
      }
      if (property.status === "ACTIVE") score += 5;
      if (property.description) score += 2;
      return { ...property, score };
    })
    .sort((a, b) => b.score - a.score);
}
