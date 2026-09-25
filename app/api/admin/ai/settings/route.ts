import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { failure, success } from "@/lib/api/response";
import { assertPermission } from "@/lib/rbac/guards";
import { findPreset } from "@/lib/ai/providers";

const schema = z.object({
  provider: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  embeddingModel: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await assertPermission("ai.settings.manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "FORBIDDEN";
    if (message === "UNAUTHORIZED") {
      if (
        process.env.APP_ENV === "local" ||
        process.env.NODE_ENV === "development"
      ) {
        // allow local bootstrap
      } else {
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
    const input = schema.parse(raw);

    const preset = findPreset(input.provider);
    const provider = input.provider || preset.id;
    const baseUrl = (input.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, "");
    const model = input.model?.trim() || preset.defaultModel;
    const embeddingModel =
      input.embeddingModel?.trim() ?? preset.defaultEmbedding;

    if (!baseUrl) throw new Error("Base URL is required for a custom provider.");
    if (!model) throw new Error("A model name is required.");

    // API key is optional on update (so provider/model can change alone).
    const apiKey = input.apiKey?.trim();
    let masked: string | null = null;
    if (apiKey) {
      if (apiKey.length < 8) throw new Error("That API key looks too short.");
      const encrypted = encryptSecret(apiKey);
      await prisma.aiSetting.upsert({
        where: { key: "llm_api_key" },
        update: { value: { encrypted, lastFour: apiKey.slice(-4) } },
        create: {
          key: "llm_api_key",
          value: { encrypted, lastFour: apiKey.slice(-4) },
        },
      });
      masked = maskSecret(apiKey);
    }

    const [newKey, legacyKey] = await Promise.all([
      prisma.aiSetting.findUnique({ where: { key: "llm_api_key" } }),
      prisma.aiSetting.findUnique({ where: { key: "openai_api_key" } }),
    ]);
    const apiKeyConfigured = Boolean(
      (newKey?.value as { encrypted?: string } | null)?.encrypted ||
        (legacyKey?.value as { encrypted?: string } | null)?.encrypted,
    );

    const value = {
      provider,
      baseUrl,
      model,
      embeddingModel,
      enabled: true,
      apiKeyConfigured,
      masked,
    };
    await prisma.aiSetting.upsert({
      where: { key: "llm" },
      update: { value },
      create: { key: "llm", value },
    });

    await prisma.auditLog.create({
      data: {
        action: "ai.settings.provider_updated",
        entityType: "ai_settings",
        entityId: "llm",
        meta: { provider, model, baseUrl },
      },
    });

    if (isForm) {
      return NextResponse.redirect(
        new URL("/admin/ai?saved=1", request.url),
        { status: 303 },
      );
    }
    return success({ saved: true, provider, model, baseUrl, apiKeyConfigured });
  } catch (error) {
    return failure(
      "AI_SETTINGS_ERROR",
      error instanceof Error ? error.message : "Failed to save settings",
      400,
    );
  }
}
