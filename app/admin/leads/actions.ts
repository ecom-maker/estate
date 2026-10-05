"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";

const STATUSES = ["new", "contacted", "closed"] as const;

/** Move a lead along: new → contacted → closed. */
export async function setLeadStatus(formData: FormData) {
  await assertPermission("customers.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(STATUSES as readonly string[]).includes(status)) return;
  await prisma.lead.update({ where: { id }, data: { status } });
  revalidatePath("/admin/leads");
}
