import { NextResponse } from "next/server";
import { resolveLLMConfig } from "@/lib/ai/provider";
import { assertPermission } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

/**
 * Admin diagnostic: reports whether an LLM provider is configured and whether a
 * minimal completion call succeeds. Never returns the API key.
 * GET /api/admin/ai/test
 */
export async function GET() {
  try {
    await assertPermission("ai.settings.view");
  } catch {
    if (
      process.env.APP_ENV !== "local" &&
      process.env.NODE_ENV === "production"
    ) {
      return NextResponse.json(
        { error: "Sign in as an admin to run this test." },
        { status: 401 },
      );
    }
  }

  const cfg = await resolveLLMConfig();
  if (!cfg) {
    return NextResponse.json({
      configured: false,
      reason:
        "No LLM config resolved — the provider key is not saved, is disabled, or could not be decrypted. Save the provider + key in /admin/ai.",
    });
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "Reply with just: OK" }],
        max_tokens: 5,
      }),
    });
    const body = await res.text();
    return NextResponse.json({
      configured: true,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      embeddingModel: cfg.embeddingModel,
      providerOk: res.ok,
      status: res.status,
      sample: body.slice(0, 600),
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      providerOk: false,
      error: error instanceof Error ? error.message : "request failed",
    });
  }
}
