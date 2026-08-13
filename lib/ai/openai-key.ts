import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";

export async function resolveOpenAIKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  try {
    const setting = await prisma.aiSetting.findUnique({
      where: { key: "openai_api_key" },
    });
    const value = setting?.value as { encrypted?: string } | null;
    if (!value?.encrypted) return null;
    return decryptSecret(value.encrypted);
  } catch {
    return null;
  }
}
