import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import { z } from "zod";

/**
 * Account-tied saved listings for the signed-in user. Covers both units and
 * projects uniformly via a stable share `ref`. Signed-out visitors save to
 * localStorage instead (client-side); this API requires a session.
 *
 * Every handler tolerates the table not existing yet (before the
 * `add_saved_listings` migration is applied) by reporting a clean failure, so
 * the client falls back to localStorage rather than crashing.
 */

const upsertSchema = z.object({
  ref: z.string().min(1).max(512),
  kind: z.enum(["property", "project"]).default("property"),
  path: z.string().min(1).max(1024),
  title: z.string().min(1).max(512),
  subtitle: z.string().max(1024).optional(),
  image: z.string().max(2048).nullish(),
});
const deleteSchema = z.object({ ref: z.string().min(1).max(512) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return failure("UNAUTHORIZED", "Sign in required", 401);
  try {
    const items = await prisma.savedListing.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return success({ items });
  } catch (error) {
    return failure(
      "SAVED_UNAVAILABLE",
      error instanceof Error ? error.message : "Failed",
      500,
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("UNAUTHORIZED", "Sign in required", 401);
  try {
    const body = upsertSchema.parse(await request.json());
    const item = await prisma.savedListing.upsert({
      where: { userId_ref: { userId: session.user.id, ref: body.ref } },
      // Keep the original saved date; refresh the display metadata.
      update: {
        kind: body.kind,
        path: body.path,
        title: body.title,
        subtitle: body.subtitle ?? null,
        image: body.image ?? null,
      },
      create: {
        userId: session.user.id,
        ref: body.ref,
        kind: body.kind,
        path: body.path,
        title: body.title,
        subtitle: body.subtitle ?? null,
        image: body.image ?? null,
      },
    });
    return success(item);
  } catch (error) {
    return failure(
      "SAVED_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("UNAUTHORIZED", "Sign in required", 401);
  try {
    const body = deleteSchema.parse(await request.json());
    await prisma.savedListing.deleteMany({
      where: { userId: session.user.id, ref: body.ref },
    });
    return success({ removed: true });
  } catch (error) {
    return failure(
      "SAVED_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}
