"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const KEYS = { leads: "leadsSeenAt", sell: "sellLeadsSeenAt" } as const;

export type SeenKind = keyof typeof KEYS;

/**
 * Record, per signed-in user, when they last opened the Leads / Sell leads
 * page. Stored in users.preferences_json so it's shared across their devices
 * and drives the "new" highlight on the admin dashboard.
 */
export async function markSeen(kind: SeenKind): Promise<void> {
  try {
    const session = await auth();
    const id = (session?.user as { id?: string } | undefined)?.id;
    if (!id) return;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { preferences: true },
    });
    const prefs = {
      ...((user?.preferences as Record<string, unknown> | null) ?? {}),
      [KEYS[kind]]: Date.now(),
    };
    await prisma.user.update({
      where: { id },
      data: { preferences: prefs as Prisma.InputJsonValue },
    });
  } catch {
    // Non-critical — the tile just stays highlighted.
  }
}
