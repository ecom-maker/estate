import { ROLE_PERMISSIONS, type Permission } from "./permissions";

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
