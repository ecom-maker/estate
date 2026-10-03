import { ROLE_PERMISSIONS, type Permission } from "./permissions";

/** Roles allowed into the staff /admin area. */
export const ADMIN_ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN"] as const;

/** True when the user holds a staff-admin role (controls /admin access + nav). */
export function isAdmin(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
}

export function hasPermission(
  roles: string[] | undefined,
  permission: Permission,
) {
  if (!roles?.length) return false;
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function requirePermission(
  roles: string[] | undefined,
  permission: Permission,
) {
  if (!hasPermission(roles, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
