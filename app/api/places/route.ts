import { prisma } from "@/lib/db/prisma";
import { success } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export type PlaceKind = "City" | "Community" | "Building";
export type Place = { label: string; kind: PlaceKind };

/**
 * Autocomplete suggestions for the /properties "City, community or building"
 * field. Sourced from live inventory only — projects that are active and have
 * at least one visible (non-hidden) unit — so every suggestion returns results.
 * The labels match exactly what `unitFiltersWhere` searches on (title,
 * community name/city/emirate).
 */
export async function GET() {
  try {
    const units = await prisma.propertyUnit.findMany({
      where: { hidden: false, property: { deletedAt: null, status: "ACTIVE" } },
      select: {
        property: {
          select: {
            title: true,
            community: { select: { name: true, city: true, emirate: true } },
          },
        },
      },
    });

    // Dedupe case-insensitively, keeping the first spelling we see. Cities and
    // emirates share the "City" bucket; buildings are the project titles.
    const seen = new Map<string, Place>();
    const add = (value: string | null | undefined, kind: PlaceKind) => {
      const label = value?.trim();
      if (!label) return;
      const key = `${kind}:${label.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { label, kind });
    };

    for (const u of units) {
      const c = u.property.community;
      add(c?.emirate, "City");
      add(c?.city, "City");
      add(c?.name, "Community");
      add(u.property.title, "Building");
    }

    const order: Record<PlaceKind, number> = { City: 0, Community: 1, Building: 2 };
    const places = [...seen.values()].sort(
      (a, b) =>
        order[a.kind] - order[b.kind] || a.label.localeCompare(b.label),
    );

    return success({ places });
  } catch {
    return success({ places: [] as Place[] });
  }
}
