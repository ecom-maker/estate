import type { ReactNode } from "react";

// Private, per-user pages — keep them out of the index (inherited by all
// /account/* routes, including client-component pages that can't export
// metadata themselves). Links are still followed.
export const metadata = { robots: { index: false, follow: true } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
