import { z } from "zod";

export const SearchIntentSchema = z.object({
  propertyType: z
    .enum(["villa", "apartment", "penthouse", "townhouse", "unit", "land"])
    .optional(),
  location: z.string().optional(),
  community: z.string().optional(),
  developer: z.string().optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  minPriceAED: z.number().nonnegative().optional(),
  maxPriceAED: z.number().nonnegative().optional(),
  minAreaSqft: z.number().nonnegative().optional(),
  maxAreaSqft: z.number().nonnegative().optional(),
  waterfront: z.boolean().optional(),
  privateBeach: z.boolean().optional(),
  furnished: z.boolean().optional(),
  offPlan: z.boolean().optional(),
  ready: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  queryText: z.string().optional(),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export function mergeSearchIntent(
  previous: SearchIntent | null | undefined,
  next: SearchIntent,
): SearchIntent {
  return SearchIntentSchema.parse({
    ...(previous ?? {}),
    ...next,
    amenities: next.amenities ?? previous?.amenities,
  });
}
