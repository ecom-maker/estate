import { z } from "zod";
import { success, failure } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { getUserLLMView, saveUserLLMConfig } from "@/lib/ai/user-llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return failure("UNAUTHORIZED", "Please sign in", 401);
  const view = await getUserLLMView(userId);
  return success(view);
}

const schema = z
  .object({
    enabled: z.boolean().optional(),
    baseUrl: z.string().trim().url("Enter a valid URL").max(300).optional().or(z.literal("")),
    model: z.string().trim().max(120).optional().or(z.literal("")),
    embeddingModel: z.string().trim().max(120).optional().or(z.literal("")),
    // Omit to keep the existing key; "" clears it; any other value replaces it.
    apiKey: z.string().max(400).optional(),
  })
  .strict();

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return failure("UNAUTHORIZED", "Please sign in", 401);

  try {
    const input = schema.parse(await request.json());
    await saveUserLLMConfig(userId, {
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      model: input.model,
      embeddingModel: input.embeddingModel,
      apiKey: input.apiKey,
    });
    const view = await getUserLLMView(userId);
    return success(view);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid input")
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return failure("VALIDATION_ERROR", message, 400);
  }
}
