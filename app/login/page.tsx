import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { headers } from "next/headers";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { availableOtpChannels, isMockOtp } from "@/lib/auth/otp-senders";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Visitor's country from the host (Vercel sets x-vercel-ip-country).
  const h = await headers();
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  const otpChannels = isMockOtp() ? (["whatsapp", "sms"] as const) : availableOtpChannels();
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Authentication
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Welcome back</h1>
      <p className="mt-3 text-sm text-muted">
        Sign in with email and password
        {isGoogleAuthEnabled ? ", Google," : ""}
        {otpChannels.length ? " or a code sent to your phone" : ""}.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <LoginForm
          googleEnabled={isGoogleAuthEnabled}
          otpChannels={[...otpChannels]}
          defaultCountry={country}
        />
      </Suspense>
    </div>
  );
}
