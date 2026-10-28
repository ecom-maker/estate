"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { assertAuthenticated } from "@/lib/rbac/guards";
import { isSuperAdmin } from "@/lib/rbac/check";
import { getSupabaseAdmin, uploadObject } from "@/lib/storage/supabase";

export type DeveloperFormState = { error?: string; ok?: boolean };

// NOC uploads: PDF or PNG only, under the 4 MB server-action body limit.
const NOC_TYPES = new Set(["application/pdf", "image/png"]);
const NOC_MAX_BYTES = 3.5 * 1024 * 1024;

const phoneClean = (v: string) => v.replace(/[^\d+()\-\s]/g, "").trim();

/**
 * Save a developer's contact details and (optionally) their NOC document from
 * the Developers admin page. One NOC per developer is kept; an empty file input
 * leaves the current one untouched, and the `nocRemove` flag clears it.
 */
export async function saveDeveloper(
  id: string,
  _prev: DeveloperFormState,
  formData: FormData,
): Promise<DeveloperFormState> {
  try {
    const session = await assertAuthenticated();
    const roles = (session.user as { roles?: string[] }).roles;
    if (!isSuperAdmin(roles)) throw new Error("FORBIDDEN");
  } catch {
    return { error: "Only super-admins can edit developers." };
  }

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = phoneClean(String(formData.get("phone") ?? "")) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  // Resolve the NOC URL: keep, replace, or remove.
  let nocUrl: string | null | undefined; // undefined = leave unchanged
  if (formData.get("nocRemove") === "on") {
    nocUrl = null;
  } else {
    const file = formData.get("noc");
    if (file instanceof File && file.size > 0) {
      if (!NOC_TYPES.has(file.type)) return { error: "NOC must be a PDF or PNG file." };
      if (file.size > NOC_MAX_BYTES) return { error: "NOC is too large (3.5 MB max)." };
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = file.type === "image/png" ? "png" : "pdf";
      const path = `noc/developers/${id}/${Date.now()}.${ext}`;
      if (getSupabaseAdmin()) {
        nocUrl = (await uploadObject({ path, body: bytes, contentType: file.type })).publicUrl;
      } else if (process.env.NODE_ENV !== "production") {
        const { mkdir, writeFile } = await import("node:fs/promises");
        const { dirname, join } = await import("node:path");
        const target = join(process.cwd(), "public", "uploads", path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
        nocUrl = `/uploads/${path}`;
      } else {
        return { error: "File storage isn't configured (Supabase)." };
      }
    }
  }

  try {
    await prisma.developer.update({
      where: { id },
      data: {
        email,
        phone,
        ...(nocUrl !== undefined ? { nocUrl } : {}),
      },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save developer.",
    };
  }

  revalidatePath("/admin/developers");
  return { ok: true };
}
