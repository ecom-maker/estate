"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import type { PropertyStatus, PropertyType } from "@prisma/client";

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
        priceAed: input.priceAed,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqft: input.areaSqft,
        offPlan: input.offPlan,
        ready: input.ready,
        waterfront: input.waterfront,
        furnished: input.furnished,
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
    await prisma.property.update({
      where: { id },
      data: {
        title: input.title,
        ...(slug ? { slug } : {}),
        type,
        status: input.status,
        description: input.description,
        priceAed: input.priceAed,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqft: input.areaSqft,
        offPlan: input.offPlan,
        ready: input.ready,
        waterfront: input.waterfront,
        furnished: input.furnished,
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
