import type { Prisma } from "@prisma/client";

/**
 * Filter properties to a single city. A city chip's label is the community's
 * `city` (or `emirate` as a fallback), so matching must check both fields —
 * case-insensitively — to catch either source of the same label.
 */
export function cityWhere(city: string): Prisma.PropertyWhereInput {
  const value = city.trim();
  return {
    community: {
      OR: [
        { city: { equals: value, mode: "insensitive" } },
        { emirate: { equals: value, mode: "insensitive" } },
      ],
    },
  };
}
