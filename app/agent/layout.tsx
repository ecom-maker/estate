import type { ReactNode } from "react";

// Internal agent console — keep out of the index (inherited by all /agent/*
// routes, including client-component pages that can't export metadata). Links
// are still followed.
export const metadata = { robots: { index: false, follow: true } };

export default function AgentLayout({ children }: { children: ReactNode }) {
  return children;
}
