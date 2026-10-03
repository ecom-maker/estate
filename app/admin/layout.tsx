import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac/check";

/**
 * Gate the entire /admin area to staff admins (SUPER_ADMIN / COMPANY_ADMIN).
 * Unauthenticated visitors go to login; signed-in non-admins (agents,
 * self-signup customers) are sent home. This is the single choke point, so
 * every current and future admin page is protected even if a page forgets its
 * own guard.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles;

  if (!session?.user?.id) {
    redirect("/login?error=AccessDenied");
  }
  if (!isAdmin(roles)) {
    redirect("/");
  }

  return <>{children}</>;
}
