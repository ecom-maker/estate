"use server";

import { splitDescription } from "@/lib/property/description";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { getSupabaseAdmin, uploadObject } from "@/lib/storage/supabase";
import { assertPermission } from "@/lib/rbac/guards";
import { canEditProperty } from "@/lib/admin/property-access";
import { recomputeAndStoreNearby } from "@/lib/property/nearby-bundle";
import { COMMUNITY_CATALOG, communityForText } from "@/lib/communities/catalog";
import { Prisma, type PropertyStatus, type PropertyType } from "@prisma/client";

export type PropertyFormState = { error?: string };

/** Normalise a value for change comparison (null/""/undefined all equal). */
function norm(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}
/** Readable, length-capped value for the edit-history record. */
function hv(v: unknown): string {
  const s = v == null || v === "" ? "—" : String(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

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
    // Completed properties can be offered for rent alongside sale (admin-set).
    forRent: formData.get("forRent") === "on",
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

/** Hide/show a unit from the public (kept in the DB either way). */
export async function setUnitHidden(formData: FormData): Promise<void> {
  try {
    await assertPermission("properties.update");
  } catch {
    return;
  }
  const id = String(formData.get("id") ?? "");
  const hidden = String(formData.get("hidden") ?? "") === "true";
  if (!id) return;
  try {
    const unit = await prisma.propertyUnit.update({
      where: { id },
      data: { hidden },
      select: { property: { select: { slug: true, offPlan: true } } },
    });
    revalidatePath("/admin/units");
    revalidatePath(
      `/${unit.property.offPlan ? "projects" : "properties"}/${unit.property.slug}`,
    );
  } catch {
    // ignore
  }
}

const UNIT_TYPES = ["APARTMENT", "PENTHOUSE", "TOWNHOUSE", "VILLA", "UNIT", "LAND"] as const;

/** Set a unit's own type; empty = unknown (the project's type applies). */
export async function setUnitType(formData: FormData): Promise<void> {
  try {
    await assertPermission("properties.update");
  } catch {
    return;
  }
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("unitType") ?? "");
  if (!id) return;
  const unitType = (UNIT_TYPES as readonly string[]).includes(raw)
    ? (raw as (typeof UNIT_TYPES)[number])
    : null;
  try {
    const unit = await prisma.propertyUnit.update({
      where: { id },
      data: { unitType },
      select: { propertyId: true },
    });
    revalidatePath(`/admin/properties/${unit.propertyId}/edit`);
    revalidatePath("/admin/units");
    revalidatePath("/properties");
  } catch {
    // ignore
  }
}

export type UnitDetailsState = { ok?: boolean; error?: string };

const UNIT_STATUSES = ["available", "reserved", "sold"] as const;

/** Edit one unit's bedrooms, price and status from the property edit page. */
export async function updateUnitDetails(
  _prev: UnitDetailsState,
  formData: FormData,
): Promise<UnitDetailsState> {
  let session;
  try {
    session = await assertPermission("properties.update");
  } catch {
    return { error: "You must be an admin to edit units." };
  }
  const id = String(formData.get("id") ?? "");
  const unit = id
    ? await prisma.propertyUnit.findUnique({
        where: { id },
        select: { propertyId: true, property: { select: { slug: true, offPlan: true } } },
      })
    : null;
  if (!unit) return { error: "Unit not found." };
  if (!(await canEditProperty(unit.propertyId, session))) {
    return { error: "Only this listing's creator or a Super Admin can edit it." };
  }

  const fields = parseUnitFields(formData);
  if ("error" in fields) return fields;

  await prisma.propertyUnit.update({ where: { id }, data: fields });
  revalidateUnitPages(unit.propertyId, unit.property, id);
  return { ok: true };
}

/** Add a unit to a property from its edit page. */
export async function createUnit(
  propertyId: string,
  _prev: UnitDetailsState,
  formData: FormData,
): Promise<UnitDetailsState> {
  let session;
  try {
    session = await assertPermission("properties.update");
  } catch {
    return { error: "You must be an admin to add units." };
  }
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { slug: true, offPlan: true },
  });
  if (!property) return { error: "Property not found." };
  if (!(await canEditProperty(propertyId, session))) {
    return { error: "Only this listing's creator or a Super Admin can edit it." };
  }

  const unitNumber = String(formData.get("unitNumber") ?? "").trim();
  if (!unitNumber) return { error: "Enter a unit number, e.g. 1BR-12 or PH-01." };
  if (unitNumber.length > 40) return { error: "Unit number is too long (40 characters max)." };
  const typeRaw = String(formData.get("unitType") ?? "");
  const unitType = (UNIT_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as (typeof UNIT_TYPES)[number])
    : null;
  const fields = parseUnitFields(formData);
  if ("error" in fields) return fields;

  try {
    const unit = await prisma.propertyUnit.create({
      data: { propertyId, unitNumber, unitType, ...fields },
      select: { id: true },
    });
    revalidateUnitPages(propertyId, property, unit.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `Unit ${unitNumber} already exists in this property.` };
    }
    throw error;
  }
  return { ok: true };
}

type UnitFields = {
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqft?: number | null;
  priceAed?: number | null;
  status?: string | null;
};

/**
 * Unit fields from a form. A field missing from the form is left out (not
 * changed); an empty one is cleared.
 */
function parseUnitFields(formData: FormData): UnitFields | { error: string } {
  const out: UnitFields = {};
  const raw = (key: string) => {
    const v = formData.get(key);
    return v == null ? undefined : String(v).replace(/,/g, "").trim();
  };
  const count = (key: "bedrooms" | "bathrooms", label: string, min: number) => {
    const v = raw(key);
    if (v === undefined) return;
    const n = v === "" ? null : Number(v);
    if (n != null && (!Number.isInteger(n) || n < min || n > 20)) {
      return `${label} must be a whole number from ${min === 0 ? "0 (studio)" : min} to 20.`;
    }
    out[key] = n;
  };
  const positive = (key: "areaSqft" | "priceAed", message: string) => {
    const v = raw(key);
    if (v === undefined) return;
    const n = v === "" ? null : Number(v);
    if (n != null && (!Number.isFinite(n) || n <= 0)) return message;
    out[key] = n;
  };
  const error =
    count("bedrooms", "Beds", 0) ??
    count("bathrooms", "Baths", 1) ??
    positive("areaSqft", "Area must be a positive number of sqft.") ??
    positive("priceAed", "Price must be a positive number in AED.");
  if (error) return { error };

  const status = raw("status");
  if (status !== undefined) {
    const s = status.toLowerCase();
    if (s && !(UNIT_STATUSES as readonly string[]).includes(s)) {
      return { error: "Status must be available, reserved or sold." };
    }
    out.status = s || null;
  }
  return out;
}

const PLAN_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const PLAN_MAX_BYTES = 3.5 * 1024 * 1024; // under the 4 MB server-action limit

/** Load a unit for a floor-plan change and check the admin may edit it. */
async function unitForPlanEdit(id: string) {
  let session;
  try {
    session = await assertPermission("properties.update");
  } catch {
    return { error: "You must be an admin to edit units." } as const;
  }
  const unit = id
    ? await prisma.propertyUnit.findUnique({
        where: { id },
        select: {
          unitNumber: true,
          areaSqft: true,
          propertyId: true,
          property: { select: { slug: true, offPlan: true } },
        },
      })
    : null;
  if (!unit) return { error: "Unit not found." } as const;
  if (!(await canEditProperty(unit.propertyId, session))) {
    return { error: "Only this listing's creator or a Super Admin can edit it." } as const;
  }
  return { unit } as const;
}

/**
 * Upload a floor plan for one unit. It is stored as the property's floor plan
 * for that unit number (replacing any earlier one), which is what the unit
 * page and the project's Units section match on.
 */
export async function uploadUnitFloorplan(
  _prev: UnitDetailsState,
  formData: FormData,
): Promise<UnitDetailsState> {
  const id = String(formData.get("id") ?? "");
  const found = await unitForPlanEdit(id);
  if ("error" in found) return { error: found.error };
  const { unit } = found;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image or PDF file." };
  if (!PLAN_TYPES.has(file.type)) return { error: "Use a PDF or a JPG, PNG or WebP image." };
  if (file.size > PLAN_MAX_BYTES) return { error: "File is too large (3.5 MB max)." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = {
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  }[file.type] ?? "jpg";
  const path = `floorplans/${unit.propertyId}/${id}-${Date.now()}.${ext}`;
  let url: string;
  if (getSupabaseAdmin()) {
    url = (await uploadObject({ path, body: bytes, contentType: file.type })).publicUrl;
  } else if (process.env.NODE_ENV !== "production") {
    // Local development without Supabase: keep the file under public/.
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const target = join(process.cwd(), "public", "uploads", path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    url = `/uploads/${path}`;
  } else {
    return { error: "File storage isn't configured (Supabase)." };
  }

  await prisma.$transaction([
    prisma.propertyFloorplan.deleteMany({
      where: { propertyId: unit.propertyId, unitRef: unit.unitNumber },
    }),
    prisma.propertyFloorplan.create({
      data: {
        propertyId: unit.propertyId,
        unitRef: unit.unitNumber,
        title: `${unit.unitNumber} floor plan`,
        url,
        mimeType: file.type,
        areaSqft: unit.areaSqft,
      },
    }),
  ]);
  revalidateUnitPages(unit.propertyId, unit.property, id);
  return { ok: true };
}

/** Remove a unit's own floor plan (the one stored for its unit number). */
export async function removeUnitFloorplan(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const found = await unitForPlanEdit(id);
  if ("error" in found) return;
  const { unit } = found;
  await prisma.propertyFloorplan.deleteMany({
    where: { propertyId: unit.propertyId, unitRef: unit.unitNumber },
  });
  revalidateUnitPages(unit.propertyId, unit.property, id);
}

function revalidateUnitPages(
  propertyId: string,
  property: { slug: string; offPlan: boolean },
  unitId: string,
) {
  revalidatePath(`/admin/properties/${propertyId}/edit`);
  revalidatePath("/admin/units");
  revalidatePath("/properties");
  // The unit URL now carries an SEO slug; revalidate the whole dynamic route.
  revalidatePath("/properties/unit/[id]", "page");
  revalidatePath(`/${property.offPlan ? "projects" : "properties"}/${property.slug}`);
}

export type RefreshNearbyState = { ok?: boolean; error?: string };

/** Admin action: recompute and re-store a property's nearby data from the APIs. */
export async function refreshNearbyData(
  _prev: RefreshNearbyState,
  formData: FormData,
): Promise<RefreshNearbyState> {
  try {
    await assertPermission("properties.update");
  } catch {
    return { error: "You must be an admin to refresh nearby data." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing property id." };
  try {
    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, slug: true, latitude: true, longitude: true, offPlan: true },
    });
    if (!property) return { error: "Property not found." };
    await recomputeAndStoreNearby(property);
    revalidatePath(`/${property.offPlan ? "projects" : "properties"}/${property.slug}`);
    revalidatePath(`/admin/properties/${id}/edit`);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not refresh.",
    };
  }
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  let session;
  try {
    session = await assertPermission("properties.create");
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
    const created = await prisma.property.create({
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
          forRent: !input.offPlan && input.forRent,
          ...(input.handoverDate ? { handoverDate: input.handoverDate } : {}),
        },
        ...(input.communityId
          ? { community: { connect: { id: input.communityId } } }
          : {}),
      },
    });

    // Record the creator (used to scope who may later edit this listing).
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user?.id ?? null,
          action: "property_create",
          entityType: "property",
          entityId: created.id,
          meta: { title: input.title } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // ignore
    }
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
  let session;
  try {
    session = await assertPermission("properties.update");
  } catch {
    return { error: "You must be signed in as an admin to edit properties." };
  }

  const input = parseForm(formData);
  if (input.title.length < 2) return { error: "Title is required." };
  const type = input.type;
  if (!type) return { error: "Please choose a property type." };

  if (!(await canEditProperty(id, session))) {
    return { error: "You can only edit listings you created." };
  }

  try {
    const slug = input.slugInput
      ? await uniqueSlug(slugify(input.slugInput), id)
      : undefined;
    const existing = await prisma.property.findUnique({
      where: { id },
      select: {
        metadata: true,
        description: true,
        title: true,
        type: true,
        status: true,
        priceAed: true,
        bedrooms: true,
        bathrooms: true,
        areaSqft: true,
        offPlan: true,
        ready: true,
        waterfront: true,
        furnished: true,
        slug: true,
      },
    });
    const metadata: Record<string, unknown> = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    };
    if (input.handoverDate) metadata.handoverDate = input.handoverDate;
    else delete metadata.handoverDate;
    metadata.dealType = input.dealType;
    metadata.forRent = !input.offPlan && input.forRent;
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

    // Edit history: record which fields changed, by whom. Best-effort so a
    // logging hiccup never fails the edit.
    try {
      const oldMeta =
        (existing?.metadata as Record<string, unknown> | null) ?? {};
      const fields: [string, unknown, unknown][] = [
        ["title", existing?.title, input.title],
        ["type", existing?.type, type],
        ["status", existing?.status, input.status],
        ["price (AED)", existing?.priceAed, input.priceAed],
        ["bedrooms", existing?.bedrooms, input.bedrooms],
        ["bathrooms", existing?.bathrooms, input.bathrooms],
        ["area (sqft)", existing?.areaSqft, input.areaSqft],
        ["off-plan", existing?.offPlan, input.offPlan],
        ["ready", existing?.ready, input.ready],
        ["waterfront", existing?.waterfront, input.waterfront],
        ["furnished", existing?.furnished, input.furnished],
        ["handover date", oldMeta.handoverDate ?? null, metadata.handoverDate ?? null],
        ["deal type", oldMeta.dealType ?? null, metadata.dealType ?? null],
        ["description", existing?.description, input.description],
        ...(slug
          ? ([["slug", existing?.slug, slug]] as [string, unknown, unknown][])
          : []),
      ];
      const changes = fields
        .filter(([, a, b]) => norm(a) !== norm(b))
        .map(([field, from, to]) => ({ field, from: hv(from), to: hv(to) }));
      if (changes.length) {
        await prisma.auditLog.create({
          data: {
            userId: session.user?.id ?? null,
            action: "property_update",
            entityType: "property",
            entityId: id,
            meta: { changes, title: input.title } as Prisma.InputJsonValue,
          },
        });
      }
    } catch {
      // ignore history write errors
    }
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
