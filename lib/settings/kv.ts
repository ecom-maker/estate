import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Tiny JSON key/value store over the generic `settings` table
 * (companyId=null). Used for MCP keys and OAuth state so no dedicated
 * migration is needed. Reads are best-effort (return the fallback on error).
 */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.setting.findFirst({
      where: { key, companyId: null },
    });
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const data = value as Prisma.InputJsonValue;
  const row = await prisma.setting.findFirst({
    where: { key, companyId: null },
  });
  if (row) {
    await prisma.setting.update({ where: { id: row.id }, data: { value: data } });
  } else {
    await prisma.setting.create({
      data: { key, companyId: null, value: data },
    });
  }
}
