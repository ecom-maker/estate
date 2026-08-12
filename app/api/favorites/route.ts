import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import { z } from "zod";

const schema = z.object({
  propertyId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      property: {
        include: {
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          community: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return success({ items: favorites });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }

  try {
    const body = schema.parse(await request.json());
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_propertyId: {
          userId: session.user.id,
          propertyId: body.propertyId,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        propertyId: body.propertyId,
      },
    });
    return success(favorite);
  } catch (error) {
    return failure(
      "FAVORITE_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }

  try {
    const body = schema.parse(await request.json());
    await prisma.favorite.delete({
      where: {
        userId_propertyId: {
          userId: session.user.id,
          propertyId: body.propertyId,
        },
      },
    });
    return success({ removed: true });
  } catch (error) {
    return failure(
      "FAVORITE_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}
