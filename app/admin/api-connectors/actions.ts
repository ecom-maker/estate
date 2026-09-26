"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto/secrets";
import { assertPermission } from "@/lib/rbac/guards";
import type { ConnectorType } from "@prisma/client";

export type ConnectorFormState = { error?: string };

const TYPES: ConnectorType[] = [
  "CRM",
  "MLS",
  "TRANSACTION",
  "COMMUNITY",
  "SCHOOL",
  "METRO",
  "AIRPORT",
  "OTHER",
];

const AUTH_TYPES = ["none", "bearer", "header"] as const;

function parseForm(formData: FormData) {
  const typeRaw = String(formData.get("type") ?? "");
  const authTypeRaw = String(formData.get("authType") ?? "bearer");
  const priorityRaw = String(formData.get("priority") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim(),
    type: (TYPES as string[]).includes(typeRaw)
      ? (typeRaw as ConnectorType)
      : null,
    baseUrl: String(formData.get("baseUrl") ?? "").trim() || null,
    authType: (AUTH_TYPES as readonly string[]).includes(authTypeRaw)
      ? authTypeRaw
      : "bearer",
    authHeaderName: String(formData.get("authHeaderName") ?? "").trim() || null,
    syncFrequency: String(formData.get("syncFrequency") ?? "").trim() || null,
    priority: priorityRaw === "" ? 100 : Number(priorityRaw),
    enabled: formData.get("enabled") === "on",
    apiKey: String(formData.get("apiKey") ?? "").trim(),
  };
}

async function upsertCredential(providerId: string, apiKey: string) {
  // Single "primary" credential per provider — replace on change.
  await prisma.apiCredential.deleteMany({ where: { providerId } });
  await prisma.apiCredential.create({
    data: {
      providerId,
      label: "primary",
      encryptedSecret: encryptSecret(apiKey),
      lastFour: apiKey.slice(-4),
    },
  });
}

export async function createConnector(
  _prev: ConnectorFormState,
  formData: FormData,
): Promise<ConnectorFormState> {
  try {
    await assertPermission("connectors.manage");
  } catch {
    return { error: "You must be signed in as an admin to add connectors." };
  }

  const input = parseForm(formData);
  if (input.name.length < 2) return { error: "Connector name is required." };
  if (!input.type) return { error: "Please choose a connector type." };

  try {
    const provider = await prisma.apiProvider.create({
      data: {
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        authConfig: {
          type: input.authType,
          headerName: input.authHeaderName ?? undefined,
        },
        syncFrequency: input.syncFrequency,
        priority: Number.isFinite(input.priority) ? input.priority : 100,
        enabled: input.enabled,
        healthStatus: "unknown",
      },
    });
    if (input.apiKey) await upsertCredential(provider.id, input.apiKey);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create connector.",
    };
  }

  revalidatePath("/admin/api-connectors");
  redirect("/admin/api-connectors");
}

export async function updateConnector(
  id: string,
  _prev: ConnectorFormState,
  formData: FormData,
): Promise<ConnectorFormState> {
  try {
    await assertPermission("connectors.manage");
  } catch {
    return { error: "You must be signed in as an admin to edit connectors." };
  }

  const input = parseForm(formData);
  if (input.name.length < 2) return { error: "Connector name is required." };
  if (!input.type) return { error: "Please choose a connector type." };

  try {
    await prisma.apiProvider.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        authConfig: {
          type: input.authType,
          headerName: input.authHeaderName ?? undefined,
        },
        syncFrequency: input.syncFrequency,
        priority: Number.isFinite(input.priority) ? input.priority : 100,
        enabled: input.enabled,
      },
    });
    if (input.apiKey) await upsertCredential(id, input.apiKey);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update connector.",
    };
  }

  revalidatePath("/admin/api-connectors");
  revalidatePath(`/admin/api-connectors/${id}/edit`);
  redirect("/admin/api-connectors");
}
