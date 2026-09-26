import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";

export type PromptKey = keyof typeof DEFAULT_PROMPTS;

/** Prompt keys the admin can edit (and that the chat actually uses). */
export const EDITABLE_PROMPTS: { key: PromptKey; label: string; help: string }[] = [
  {
    key: "system",
    label: "System prompt",
    help: "Core behavior + guardrails, applied to every response.",
  },
  {
    key: "search",
    label: "Search prompt",
    help: "How the assistant presents conversational search results.",
  },
  {
    key: "propertyAssistant",
    label: "Property assistant prompt",
    help: "How it answers questions about a specific property.",
  },
];

/**
 * Resolve prompts by key: admin-edited PromptTemplate content when present,
 * otherwise the built-in default. Never throws.
 */
export async function getPrompts(
  keys: PromptKey[],
): Promise<Record<PromptKey, string>> {
  const out = {} as Record<PromptKey, string>;
  for (const key of keys) out[key] = DEFAULT_PROMPTS[key];
  try {
    const rows = await prisma.promptTemplate.findMany({
      where: { key: { in: keys } },
    });
    for (const row of rows) {
      if (row.content?.trim()) out[row.key as PromptKey] = row.content;
    }
  } catch {
    // fall back to defaults
  }
  return out;
}
