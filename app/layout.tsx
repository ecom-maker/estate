import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Providers } from "@/components/providers";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DM Global",
    template: "%s · DM Global",
  },
  description:
    "AI-native luxury real estate discovery — conversational search for villas, residences, and investment properties.",
  metadataBase: new URL(getAppUrl()),
  // Machine-readable entry points for AI agents (A2A Agent Card, API, llms.txt).
  alternates: {
    types: {
      "application/json": "/.well-known/agent-card.json",
      "application/openapi+json": "/api/v1/openapi.json",
      "text/plain": "/llms.txt",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
