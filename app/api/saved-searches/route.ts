import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import { SearchIntentSchema } from "@/lib/validation/search-intent";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  intent: SearchIntentSchema,
  notify: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }
  const items = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return success({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return failure("UNAUTHORIZED", "Sign in required", 401);
  }
  try {
    const body = createSchema.parse(await request.json());
    const item = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        name: body.name,
        intent: body.intent,
        notify: body.notify ?? false,
      },
    });
    return success(item);
  } catch (error) {
    return failure(
      "SAVED_SEARCH_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}
