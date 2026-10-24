import { Suspense } from "react";
import { headers } from "next/headers";
import { SignupForm } from "@/components/auth/signup-form";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { availableOtpChannels, isMockOtp } from "@/lib/auth/otp-senders";

export const metadata = {
  title: "Create account",
  robots: { index: false, follow: true },
};

export default async function SignupPage() {
  // Visitor's country from the host (Vercel sets x-vercel-ip-country).
  const h = await headers();
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  const otpChannels = isMockOtp() ? (["whatsapp", "sms"] as const) : availableOtpChannels();
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Get started
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        Sign up with email and password
        {isGoogleAuthEnabled ? (otpChannels.length ? ", Google" : " or Google") : ""}
        {otpChannels.length ? " or your phone number" : ""} to save searches
        and favourites.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <SignupForm
          googleEnabled={isGoogleAuthEnabled}
          otpChannels={[...otpChannels]}
          defaultCountry={country}
        />
      </Suspense>
    </div>
  );
}
