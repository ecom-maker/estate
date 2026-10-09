"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { SignInGateProvider } from "@/components/auth/sign-in-gate";

export function Providers({
  children,
  googleClientId = null,
}: {
  children: React.ReactNode;
  googleClientId?: string | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <SignInGateProvider googleClientId={googleClientId}>{children}</SignInGateProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
