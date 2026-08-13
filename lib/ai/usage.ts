import { prisma } from "@/lib/db/prisma";

export async function logAiUsage(input: {
  feature: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  status: string;
  error?: string;
  userId?: string;
  sessionId?: string;
}) {
  try {
    await prisma.aiLog.create({
      data: {
        feature: input.feature,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens:
          input.totalTokens ??
          (input.inputTokens ?? 0) + (input.outputTokens ?? 0),
        estimatedCost: input.estimatedCost,
        latencyMs: input.latencyMs,
        status: input.status,
        error: input.error,
        userId: input.userId,
        sessionId: input.sessionId,
      },
    });
  } catch {
    // never block the user path on logging failure
  }
}
