export const ADMIN_ROLE_NAMES = ["SUPER_ADMIN", "COMPANY_ADMIN"] as const;
export type AdminRoleName = (typeof ADMIN_ROLE_NAMES)[number];
