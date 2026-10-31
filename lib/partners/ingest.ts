import "server-only";
import { z } from "zod";
import type { Prisma, PropertyType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { communityForText } from "@/lib/communities/catalog";

const TYPE_MAP: Record<string, PropertyType> = {
  villa: "VILLA",
  apartment: "APARTMENT",
  flat: "APARTMENT",
  penthouse: "PENTHOUSE",
  townhouse: "TOWNHOUSE",
  unit: "UNIT",
  land: "LAND",
  plot: "LAND",
};

export const listingSchema = z.object({
  externalId: z.string().min(1).max(120),
  title: z.string().min(2).max(300),
  type: z.string().transform((v) => v.toLowerCase().trim()),
  dealType: z.enum(["sale", "rent"]).optional().default("sale"),
  priceAed: z.number().positive().optional(),
  price: z
    .object({ currency: z.string().optional(), amount: z.number().positive() })
    .optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  areaSqft: z.number().positive().optional(),
  community: z.string().max(160).optional(),
  developer: z.string().max(160).optional(),
  offPlan: z.boolean().optional(),
  handoverDate: z.string().max(40).optional(),
  furnished: z.boolean().optional(),
  waterfront: z.boolean().optional(),
  description: z.string().max(20000).optional(),
  images: z.array(z.string().url()).max(40).optional(),
  amenities: z.array(z.string().min(1).max(80)).max(60).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contact: z.record(z.string(), z.unknown()).optional(),
});

export type ListingInput = z.infer<typeof listingSchema>;

export type IngestResult =
  | {
      externalId: string;
      action: "created" | "updated";
      id: string;
      slug: string;
      status: string;
      url: string;
    }
  | { externalId: string; error: string };

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "listing";
  let slug = root;
  let n = 1;
  // Append -2, -3… until free (ignoring the record we're updating).
  while (true) {
    const clash = await prisma.property.findFirst({
      where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${root}-${n}`;
  }
}

/** Resolve a community id by name (exact-ish) or by matching the title. */
async function resolveCommunityId(
  name: string | undefined,
  title: string,
): Promise<string | null> {
  if (name) {
    const row = await prisma.community.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (row) return row.id;
  }
  const guess = communityForText(`${name ?? ""} ${title}`);
  if (guess) {
    const row = await prisma.community.findFirst({
      where: { slug: guess.slug },
      select: { id: true },
    });
    if (row) return row.id;
  }
  return null;
}

async function resolveDeveloperId(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const row = await prisma.developer.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Create or update one partner listing, keyed on (source, externalId).
 * Submissions land as DRAFT for admin review; an existing listing keeps its
 * current status (so an approved listing isn't demoted on re-submit). Images
 * and amenities are fully replaced from the payload.
 */
export async function upsertListing(
  partner: { partnerId: string; company: string },
  input: ListingInput,
  siteUrl: string,
): Promise<IngestResult> {
  const type = TYPE_MAP[input.type];
  if (!type) {
    return {
      externalId: input.externalId,
      error: `Unsupported type '${input.type}'. Use one of: villa, apartment, penthouse, townhouse, unit, land.`,
    };
  }

  const source = `partner:${partner.partnerId}`;
  const priceAed = input.priceAed ?? input.price?.amount ?? null;
  const [communityId, developerId] = await Promise.all([
    resolveCommunityId(input.community, input.title),
    resolveDeveloperId(input.developer),
  ]);

  const existing = await prisma.property.findFirst({
    where: { source, externalId: input.externalId },
    select: { id: true, slug: true, status: true, metadata: true },
  });

  const metadata: Record<string, unknown> = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    dealType: input.dealType,
    partner: partner.company,
    ...(input.handoverDate ? { handoverDate: input.handoverDate } : {}),
    ...(input.community && !communityId ? { locationText: input.community } : {}),
    ...(input.developer && !developerId ? { developerName: input.developer } : {}),
    ...(input.contact ? { partnerContact: input.contact } : {}),
    submittedAt: new Date().toISOString(),
  };

  const slug = existing?.slug ?? (await uniqueSlug(input.title));

  const data = {
    title: input.title,
    type,
    priceAed,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    areaSqft: input.areaSqft ?? null,
    offPlan: input.offPlan ?? false,
    ready: !(input.offPlan ?? false),
    furnished: input.furnished ?? false,
    waterfront: input.waterfront ?? false,
    description: input.description ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    metadata: metadata as Prisma.InputJsonValue,
    ...(communityId ? { community: { connect: { id: communityId } } } : {}),
    ...(developerId ? { developer: { connect: { id: developerId } } } : {}),
  };

  const amenityConnect = input.amenities?.length
    ? await Promise.all(
        input.amenities.map(async (name) => {
          const a = await prisma.amenity.upsert({
            where: { name },
            update: {},
            create: { name },
            select: { id: true },
          });
          return a.id;
        }),
      )
    : [];

  let id: string;
  let action: "created" | "updated";

  if (existing) {
    await prisma.property.update({ where: { id: existing.id }, data });
    id = existing.id;
    action = "updated";
  } else {
    const created = await prisma.property.create({
      data: {
        ...data,
        slug,
        source,
        externalId: input.externalId,
        status: "DRAFT",
      },
    });
    id = created.id;
    action = "created";
  }

  // Replace images + amenities from the payload.
  if (input.images) {
    await prisma.propertyImage.deleteMany({ where: { propertyId: id } });
    if (input.images.length) {
      await prisma.propertyImage.createMany({
        data: input.images.map((url, i) => ({
          propertyId: id,
          url,
          sortOrder: i,
          isPrimary: i === 0,
        })),
      });
    }
  }
  if (input.amenities) {
    await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });
    if (amenityConnect.length) {
      await prisma.propertyAmenity.createMany({
        data: amenityConnect.map((amenityId) => ({ propertyId: id, amenityId })),
        skipDuplicates: true,
      });
    }
  }

  return {
    externalId: input.externalId,
    action,
    id,
    slug,
    status: existing?.status ?? "DRAFT",
    url: `${siteUrl}/properties/${slug}`,
  };
}
