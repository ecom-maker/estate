"use server";

import { revalidatePath } from "next/cache";
import { assertAuthenticated } from "@/lib/rbac/guards";
import { isSuperAdmin } from "@/lib/rbac/check";
import { createMcpKey, revokeMcpKey } from "@/lib/mcp/keys";
import { setOauthEnabled } from "@/lib/mcp/oauth";

export type McpKeyState = {
  error?: string;
  // Plaintext shown exactly once, right after creation.
  created?: { label: string; plaintext: string };
};

async function requireSuperAdmin(): Promise<boolean> {
  try {
    const session = await assertAuthenticated();
    const roles = (session.user as { roles?: string[] }).roles;
    return isSuperAdmin(roles);
  } catch {
    return false;
  }
}

export async function createKeyAction(
  _prev: McpKeyState,
  formData: FormData,
): Promise<McpKeyState> {
  if (!(await requireSuperAdmin())) {
    return { error: "Only super-admins can manage MCP keys." };
  }
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return { error: "Give the key a label (e.g. a client name)." };
  try {
    const { plaintext } = await createMcpKey(label);
    revalidatePath("/admin/mcp");
    return { created: { label, plaintext } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create key.",
    };
  }
}

export async function setOauthAction(
  _prev: McpKeyState,
  formData: FormData,
): Promise<McpKeyState> {
  if (!(await requireSuperAdmin())) {
    return { error: "Only super-admins can change OAuth settings." };
  }
  try {
    await setOauthEnabled(String(formData.get("enabled")) === "true");
    revalidatePath("/admin/mcp");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update OAuth.",
    };
  }
}

export async function revokeKeyAction(
  _prev: McpKeyState,
  formData: FormData,
): Promise<McpKeyState> {
  if (!(await requireSuperAdmin())) {
    return { error: "Only super-admins can manage MCP keys." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing key id." };
  try {
    await revokeMcpKey(id);
    revalidatePath("/admin/mcp");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to revoke key.",
    };
  }
}
