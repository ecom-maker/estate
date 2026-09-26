import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { failure, success } from "@/lib/api/response";
import { assertPermission } from "@/lib/rbac/guards";
import { EDITABLE_PROMPTS } from "@/lib/ai/get-prompt";

export async function POST(request: Request) {
  try {
    await assertPermission("ai.settings.manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "FORBIDDEN";
    if (message === "UNAUTHORIZED") {
      if (
        !(
          process.env.APP_ENV === "local" ||
          process.env.NODE_ENV === "development"
        )
      ) {
        return failure("UNAUTHORIZED", "Sign in required", 401);
      }
    } else if (process.env.NODE_ENV === "production") {
      return failure("FORBIDDEN", "Missing permission", 403);
    }
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isForm = !contentType.includes("application/json");
    const raw: Record<string, unknown> = isForm
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json();

    for (const { key, label } of EDITABLE_PROMPTS) {
      if (!(key in raw)) continue;
      const content = String(raw[key] ?? "").trim();
      if (content) {
        await prisma.promptTemplate.upsert({
          where: { key },
          update: { content, name: label },
          create: { key, name: label, content },
        });
      } else {
        // Blank → revert to the built-in default.
        await prisma.promptTemplate.deleteMany({ where: { key } });
      }
    }

    await prisma.auditLog
      .create({ data: { action: "ai.prompts_updated", entityType: "ai_prompts" } })
      .catch(() => undefined);

    if (isForm) {
      return NextResponse.redirect(new URL("/admin/ai?saved=1", request.url), {
        status: 303,
      });
    }
    return success({ saved: true });
  } catch (error) {
    return failure(
      "PROMPT_SAVE_ERROR",
      error instanceof Error ? error.message : "Failed to save prompts",
      400,
    );
  }
}
