import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { failure, success } from "@/lib/api/response";
import { assertPermission } from "@/lib/rbac/guards";

const schema = z.object({
  apiKey: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    await assertPermission("ai.settings.manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "FORBIDDEN";
    if (message === "UNAUTHORIZED") {
      // Allow local bootstrap when unauthenticated for development only
      if (process.env.APP_ENV === "local" || process.env.NODE_ENV === "development") {
        // continue
      } else {
        return failure("UNAUTHORIZED", "Sign in required", 401);
      }
    } else if (message !== "UNAUTHORIZED" && process.env.NODE_ENV === "production") {
      return failure("FORBIDDEN", "Missing permission", 403);
    }
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let apiKey = "";
    if (contentType.includes("application/json")) {
      const json = await request.json();
      apiKey = schema.parse(json).apiKey;
    } else {
      const form = await request.formData();
      apiKey = schema.parse({ apiKey: form.get("apiKey") }).apiKey;
    }

    const encrypted = encryptSecret(apiKey);
    await prisma.aiSetting.upsert({
      where: { key: "openai_api_key" },
      update: { value: { encrypted, lastFour: apiKey.slice(-4) } },
      create: {
        key: "openai_api_key",
        value: { encrypted, lastFour: apiKey.slice(-4) },
      },
    });
    await prisma.aiSetting.upsert({
      where: { key: "llm" },
      update: {
        value: {
          provider: "openai",
          model: "gpt-4.1-mini",
          temperature: 0.2,
          streaming: true,
          enabled: true,
          apiKeyConfigured: true,
          masked: maskSecret(apiKey),
        },
      },
      create: {
        key: "llm",
        value: {
          provider: "openai",
          model: "gpt-4.1-mini",
          temperature: 0.2,
          streaming: true,
          enabled: true,
          apiKeyConfigured: true,
          masked: maskSecret(apiKey),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ai.settings.api_key_updated",
        entityType: "ai_settings",
        entityId: "openai_api_key",
        meta: { masked: maskSecret(apiKey) },
      },
    });

    return success({ saved: true, masked: maskSecret(apiKey) });
  } catch (error) {
    return failure(
      "AI_SETTINGS_ERROR",
      error instanceof Error ? error.message : "Failed to save settings",
      400,
    );
  }
}
