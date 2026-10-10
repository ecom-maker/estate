"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";

/** Reschedule a viewing (lead of kind "viewing") to a new date and/or time. */
export async function rescheduleViewing(
  id: string,
  preferredDate: string,
  preferredTime: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPermission("customers.manage");
  } catch {
    return { ok: false, error: "Not authorized" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return { ok: false, error: "Date must be YYYY-MM-DD" };
  }
  try {
    await prisma.lead.update({
      where: { id },
      data: { preferredDate, preferredTime: preferredTime?.trim() || null },
    });
  } catch {
    return { ok: false, error: "Could not update the viewing" };
  }
  revalidatePath("/admin/calendar");
  return { ok: true };
}
