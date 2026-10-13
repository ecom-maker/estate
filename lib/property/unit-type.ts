import type { PropertyType } from "@prisma/client";

/**
 * A unit's own type (penthouse, villa, …) from what the data feed stored.
 *
 * Projects carry one `type` (usually APARTMENT for a tower) plus the feed's
 * list of unit types in `metadata.unitTypes` ("Apartments", "Penthouse"). Unit
 * rows only have a name like "1BR-21", so a penthouse inside a tower can't be
 * told apart unless the feed says so on the unit itself. Evidence, strongest
 * first:
 *   1. a type field in the unit's feed metadata (unit_type, type, …)
 *   2. the unit's name ("PH-01", "Penthouse A", "Duplex 3BR")
 *   3. the project: its own type when that isn't a tower (villa, townhouse…),
 *      or the only type in its feed list
 * No evidence → null, and the project's type applies.
 */

export type UnitTypeSource = "unit-feed" | "unit-name" | "project";
export type InferredUnitType = { type: PropertyType; source: UnitTypeSource };

// Checked in order: "Penthouse Apartment" is a penthouse, "Hotel Apartment" a
// unit, "Townhouse Villa" a townhouse.
const KEYWORDS: [RegExp, PropertyType][] = [
  [/pent\s*-?house|\bph\b/i, "PENTHOUSE"],
  [/town\s*-?house|row\s*house|\bth\b/i, "TOWNHOUSE"],
  [/hotel|serviced|office|shop|retail|commercial|whole\s+building|(full|half)\s+floor/i, "UNIT"],
  [/villa|bungalow|mansion|compound/i, "VILLA"],
  [/\bplot\b|\bland\b/i, "LAND"],
  [/apartment|\bflat\b|studio|duplex|triplex|loft|simplex|residence/i, "APARTMENT"],
];

/** "Penthouses" → PENTHOUSE; null when it names no known type. */
export function typeFromText(text: unknown): PropertyType | null {
  if (typeof text !== "string" || !text.trim()) return null;
  for (const [re, type] of KEYWORDS) if (re.test(text)) return type;
  return null;
}

// Feed keys that may hold a unit's type, in priority order.
const UNIT_TYPE_KEYS = [
  "unit_type",
  "unitType",
  "property_type",
  "propertyType",
  "type",
  "typology",
  "category",
  "unit_name",
  "name",
  "title",
];

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function inferUnitType(
  unit: { unitNumber: string; metadata: unknown },
  project: { type: PropertyType; metadata: unknown },
): InferredUnitType | null {
  const meta = obj(unit.metadata);
  for (const key of UNIT_TYPE_KEYS) {
    const type = typeFromText(meta[key]);
    if (type) return { type, source: "unit-feed" };
  }

  // Unit names are mostly bed labels ("1BR-21"); only clear words count, so
  // "Studio" names fall through to the project rather than forcing APARTMENT.
  const fromName = typeFromText(unit.unitNumber);
  if (fromName && fromName !== "APARTMENT") return { type: fromName, source: "unit-name" };

  if (project.type !== "APARTMENT" && project.type !== "UNIT") {
    return { type: project.type, source: "project" };
  }
  const listed = new Set(
    (Array.isArray(obj(project.metadata).unitTypes) ? (obj(project.metadata).unitTypes as unknown[]) : [])
      .map(typeFromText)
      .filter((t): t is PropertyType => t != null),
  );
  if (listed.size === 1) return { type: [...listed][0], source: "project" };
  return null;
}

/** Project lists this type among its unit types (from the feed). */
export function projectListsType(projectMetadata: unknown, type: PropertyType): boolean {
  const list = obj(projectMetadata).unitTypes;
  return Array.isArray(list) && list.some((t) => typeFromText(t) === type);
}
