"use server";

import { revalidatePath } from "next/cache";
import { assertAuthenticated } from "@/lib/rbac/guards";
import { isSuperAdmin } from "@/lib/rbac/check";
import { createPartnerKey, revokePartnerKey } from "@/lib/partners/keys";

export type PartnerKeyState = {
  error?: string;
  created?: { company: string; plaintext: string };
};

async function requireSuperAdmin(): Promise<boolean> {
  try {
    const session = await assertAuthenticated();
    return isSuperAdmin((session.user as { roles?: string[] }).roles);
  } catch {
    return false;
  }
}

export async function createPartnerKeyAction(
  _prev: PartnerKeyState,
  formData: FormData,
): Promise<PartnerKeyState> {
  if (!(await requireSuperAdmin())) {
    return { error: "Only super-admins can manage partner keys." };
  }
  const company = String(formData.get("company") ?? "").trim();
  if (company.length < 2) return { error: "Enter the partner company name." };
  try {
    const { plaintext } = await createPartnerKey(company);
    revalidatePath("/admin/partners");
    return { created: { company, plaintext } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create key.",
    };
  }
}

export async function revokePartnerKeyAction(
  _prev: PartnerKeyState,
  formData: FormData,
): Promise<PartnerKeyState> {
  if (!(await requireSuperAdmin())) {
    return { error: "Only super-admins can manage partner keys." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing key id." };
  try {
    await revokePartnerKey(id);
    revalidatePath("/admin/partners");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to revoke key.",
    };
  }
}
