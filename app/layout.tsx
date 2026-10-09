import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Providers } from "@/components/providers";
import { googleOneTapClientId } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

// Google Analytics (gtag.js) measurement ID.
const GA_ID = "G-1MSR0W0FLP";

export const metadata: Metadata = {
  title: {
    default: "DM Global",
    template: "%s · DM Global",
  },
  description:
    "AI-native luxury real estate discovery — conversational search for villas, residences, and investment properties.",
  metadataBase: new URL(getAppUrl()),
  // Renders <meta name="google-site-verification" ...> in <head> on every page.
  verification: {
    google: "YCxaPp99sf296IxMbtM1FUtXRt1z8UXQpQqaR5FXupg",
  },
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
        {/* Google tag (gtag.js) — loaded once per page via the root layout. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
        <Providers googleClientId={googleOneTapClientId}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
