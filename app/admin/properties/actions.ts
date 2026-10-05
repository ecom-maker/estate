"use server";

import { splitDescription } from "@/lib/property/description";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { COMMUNITY_CATALOG, communityForText } from "@/lib/communities/catalog";
import { Prisma, type PropertyStatus, type PropertyType } from "@prisma/client";

export type PropertyFormState = { error?: string };

const TYPES: PropertyType[] = [
  "VILLA",
  "APARTMENT",
  "PENTHOUSE",
  "TOWNHOUSE",
  "UNIT",
  "LAND",
];
const STATUSES: PropertyStatus[] = [
  "DRAFT",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "OFF_MARKET",
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function num(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "");
  const statusRaw = String(formData.get("status") ?? "DRAFT");
  return {
    title,
    type: (TYPES as string[]).includes(typeRaw)
      ? (typeRaw as PropertyType)
      : null,
    status: (STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as PropertyStatus)
      : ("DRAFT" as PropertyStatus),
    communityId: String(formData.get("communityId") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    priceAed: num(formData.get("priceAed")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    areaSqft: num(formData.get("areaSqft")),
    offPlan: formData.get("offPlan") === "on",
    ready: formData.get("ready") === "on",
    waterfront: formData.get("waterfront") === "on",
    furnished: formData.get("furnished") === "on",
    handoverDate: String(formData.get("handoverDate") ?? "").trim() || null,
    dealType:
      String(formData.get("dealType") ?? "sale") === "rent" ? "rent" : "sale",
    slugInput: String(formData.get("slug") ?? "").trim(),
  };
}

/** Produce a slug unique across properties (optionally excluding one id). */
async function uniqueSlug(base: string, excludeId?: string) {
  const root = base || `property-${nanoid(6)}`;
  let slug = root;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.property.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${root}-${nanoid(4)}`;
  }
  return `${root}-${nanoid(8)}`;
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  try {
    await assertPermission("properties.create");
  } catch {
    return { error: "You must be signed in as an admin to create properties." };
  }

  const input = parseForm(formData);
  if (input.title.length < 2) return { error: "Title is required." };
  const type = input.type;
  if (!type) return { error: "Please choose a property type." };

  try {
    const slug = await uniqueSlug(
      input.slugInput ? slugify(input.slugInput) : slugify(input.title),
    );
    await prisma.property.create({
      data: {
        title: input.title,
        slug,
        type,
        status: input.status,
        source: "MANUAL",
        description: input.description,
        descriptionSections: splitDescription(input.description) as Prisma.InputJsonValue,
        priceAed: input.priceAed,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqft: input.areaSqft,
        offPlan: input.offPlan,
        ready: input.ready,
        waterfront: input.waterfront,
        furnished: input.furnished,
        metadata: {
          dealType: input.dealType,
          ...(input.handoverDate ? { handoverDate: input.handoverDate } : {}),
        },
        ...(input.communityId
          ? { community: { connect: { id: input.communityId } } }
          : {}),
      },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create property.",
    };
  }

  revalidatePath("/admin/properties");
  redirect("/admin/properties");
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  try {
    await assertPermission("properties.update");
  } catch {
    return { error: "You must be signed in as an admin to edit properties." };
  }

  const input = parseForm(formData);
  if (input.title.length < 2) return { error: "Title is required." };
  const type = input.type;
  if (!type) return { error: "Please choose a property type." };

  try {
    const slug = input.slugInput
      ? await uniqueSlug(slugify(input.slugInput), id)
      : undefined;
    const existing = await prisma.property.findUnique({
      where: { id },
      select: { metadata: true, description: true },
    });
    const metadata: Record<string, unknown> = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    };
    if (input.handoverDate) metadata.handoverDate = input.handoverDate;
    else delete metadata.handoverDate;
    metadata.dealType = input.dealType;
    await prisma.property.update({
      where: { id },
      data: {
        title: input.title,
        ...(slug ? { slug } : {}),
        type,
        status: input.status,
        description: input.description,
        // A changed description gets new sections, and its AI summary/key
        // points are cleared so scripts/structure-descriptions.ts rewrites them.
        ...(input.description !== (existing?.description ?? null)
          ? {
              descriptionSections: splitDescription(input.description) as Prisma.InputJsonValue,
              summary: null,
              highlights: Prisma.DbNull,
            }
          : {}),
        priceAed: input.priceAed,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqft: input.areaSqft,
        offPlan: input.offPlan,
        ready: input.ready,
        waterfront: input.waterfront,
        furnished: input.furnished,
        metadata: metadata as Prisma.InputJsonValue,
        community: input.communityId
          ? { connect: { id: input.communityId } }
          : { disconnect: true },
      },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update property.",
    };
  }

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}/edit`);
  redirect("/admin/properties");
}

export type BackfillState = {
  done?: boolean;
  error?: string;
  createdCommunities?: number;
  relinked?: number;
  unlinked?: string[];
};

/**
 * Ensure every canonical community exists, then link each property to the
 * community implied by its title/slug. Idempotent — safe to run repeatedly.
 */
export async function backfillCommunities(
  _prev: BackfillState,
  _formData: FormData,
): Promise<BackfillState> {
  void _prev;
  void _formData;
  try {
    await assertPermission("properties.update");
  } catch {
    return { error: "You must be signed in as an admin to run this." };
  }

  try {
    // Match an existing community by slug OR name (case-insensitive) so we
    // never create a duplicate for one seeded earlier under a different slug.
    let createdCommunities = 0;
    const idBySlug = new Map<string, string>();
    for (const community of COMMUNITY_CATALOG) {
      let row = await prisma.community.findFirst({
        where: {
          OR: [
            { slug: community.slug },
            { name: { equals: community.name, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (!row) {
        row = await prisma.community.create({
          data: {
            name: community.name,
            slug: community.slug,
            city: "Dubai",
            emirate: "Dubai",
          },
          select: { id: true },
        });
        createdCommunities++;
      }
      idBySlug.set(community.slug, row.id);
    }

    const properties = await prisma.property.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, slug: true, communityId: true },
    });

    let relinked = 0;
    const unlinked: string[] = [];
    for (const property of properties) {
      const match = communityForText(`${property.title} ${property.slug}`);
      if (!match) {
        if (!property.communityId) unlinked.push(property.title);
        continue;
      }
      const targetId = idBySlug.get(match.slug);
      if (targetId && property.communityId !== targetId) {
        await prisma.property.update({
          where: { id: property.id },
          data: { communityId: targetId },
        });
        relinked++;
      }
    }

    revalidatePath("/admin/properties");
    return { done: true, createdCommunities, relinked, unlinked };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Backfill failed.",
    };
  }
}
