import { MockCRMAdapter } from "@/lib/connectors/crm/adapter";
import { MockMLSAdapter } from "@/lib/connectors/mls/adapter";
import { MockTransactionAdapter } from "@/lib/connectors/transactions/adapter";
import type { NormalizedProperty } from "@/lib/connectors/types";
import { prisma } from "@/lib/db/prisma";
import type { PropertyType } from "@prisma/client";

function toType(value?: string): PropertyType {
  const key = (value ?? "unit").toUpperCase();
  if (
    ["VILLA", "APARTMENT", "PENTHOUSE", "TOWNHOUSE", "UNIT", "LAND"].includes(
      key,
    )
  ) {
    return key as PropertyType;
  }
  return "UNIT";
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function upsertNormalizedProperty(property: NormalizedProperty) {
  const slugBase = slugify(property.title);
  const slug = `${slugBase}-${property.externalId}`.slice(0, 80);

  let communityId: string | undefined;
  if (property.community) {
    const community = await prisma.community.upsert({
      where: { slug: slugify(property.community) },
      update: {},
      create: {
        name: property.community,
        slug: slugify(property.community),
      },
    });
    communityId = community.id;
  }

  let developerId: string | undefined;
  if (property.developer) {
    const developer = await prisma.developer.upsert({
      where: { slug: slugify(property.developer) },
      update: {},
      create: {
        name: property.developer,
        slug: slugify(property.developer),
      },
    });
    developerId = developer.id;
  }

  return prisma.property.upsert({
    where: {
      source_externalId: {
        source: property.source,
        externalId: property.externalId,
      },
    },
    update: {
      title: property.title,
      description: property.description,
      priceAed: property.priceAED,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaSqft: property.areaSqft,
      waterfront: property.waterfront ?? false,
      privateBeach: property.privateBeach ?? false,
      furnished: property.furnished ?? false,
      offPlan: property.offPlan ?? false,
      ready: property.ready ?? true,
      communityId,
      developerId,
      latitude: property.latitude,
      longitude: property.longitude,
      type: toType(property.propertyType),
      status: "ACTIVE",
    },
    create: {
      source: property.source,
      externalId: property.externalId,
      title: property.title,
      slug,
      description: property.description,
      priceAed: property.priceAED,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaSqft: property.areaSqft,
      waterfront: property.waterfront ?? false,
      privateBeach: property.privateBeach ?? false,
      furnished: property.furnished ?? false,
      offPlan: property.offPlan ?? false,
      ready: property.ready ?? true,
      communityId,
      developerId,
      latitude: property.latitude,
      longitude: property.longitude,
      type: toType(property.propertyType),
      status: "ACTIVE",
      metadata: { synced: true, ...(property.metadata ?? {}) },
    },
  });
}

export async function runMockSync(source: "crm" | "mls" | "transactions") {
  if (source === "crm") {
    const adapter = new MockCRMAdapter();
    const rows = await adapter.fetchPage(1);
    const results = [];
    for (const row of rows) {
      results.push(await upsertNormalizedProperty(adapter.normalize(row)));
    }
    return { source, upserted: results.length };
  }

  if (source === "mls") {
    const adapter = new MockMLSAdapter();
    const rows = await adapter.fetchPage(1);
    const results = [];
    for (const row of rows) {
      results.push(await upsertNormalizedProperty(adapter.normalize(row)));
    }
    return { source, upserted: results.length };
  }

  const adapter = new MockTransactionAdapter();
  const rows = await adapter.fetchPage(1);
  return { source, fetched: rows.length, note: "Transactions logged only in mock mode" };
}
