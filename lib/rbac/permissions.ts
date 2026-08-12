export const PERMISSIONS = [
  "properties.view",
  "properties.create",
  "properties.update",
  "properties.delete",
  "agents.view",
  "agents.manage",
  "ai.settings.view",
  "ai.settings.manage",
  "connectors.view",
  "connectors.manage",
  "analytics.view",
  "audit_logs.view",
  "knowledge.manage",
  "customers.view",
  "customers.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  COMPANY_ADMIN: [
    "properties.view",
    "properties.create",
    "properties.update",
    "properties.delete",
    "agents.view",
    "agents.manage",
    "ai.settings.view",
    "ai.settings.manage",
    "connectors.view",
    "connectors.manage",
    "analytics.view",
    "audit_logs.view",
    "knowledge.manage",
    "customers.view",
    "customers.manage",
  ],
  AGENT: [
    "properties.view",
    "customers.view",
    "customers.manage",
    "analytics.view",
  ],
  CUSTOMER: ["properties.view"],
};
