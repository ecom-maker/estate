import { prisma } from "@/lib/db/prisma";

type SessionLike = { user?: { id?: string | null; roles?: string[] } } | null;

/** The admin who first created this property (from the create audit record). */
export async function propertyCreatorId(
  propertyId: string,
): Promise<string | null> {
  const log = await prisma.auditLog.findFirst({
    where: {
      action: "property_create",
      entityType: "property",
      entityId: propertyId,
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return log?.userId ?? null;
}

/**
 * Edit rights: a Super Admin may edit any listing; anyone else only listings
 * they created. Listings with no recorded creator (legacy or synced) stay
 * editable by any admin so management is never locked out.
 */
export async function canEditProperty(
  propertyId: string,
  session: SessionLike,
): Promise<boolean> {
  const roles = session?.user?.roles ?? [];
  if (roles.includes("SUPER_ADMIN")) return true;
  const creator = await propertyCreatorId(propertyId);
  return creator == null || creator === session?.user?.id;
}
