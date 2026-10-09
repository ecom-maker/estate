"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authHref, safeReturnTo } from "@/lib/auth/return-to";
import { PhoneInput } from "@/components/auth/phone-input";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toE164, type Country } from "@/lib/phone/countries";
import { cn } from "@/lib/utils";

type OtpChannel = "whatsapp" | "sms";

type LoginFormProps = {
  googleEnabled?: boolean;
  /** Code channels that are set up; the phone section is hidden when empty. */
  otpChannels?: OtpChannel[];
  /** Visitor's country from their IP (ISO code), used for the phone picker. */
  defaultCountry?: string | null;
};

export function LoginForm({
  googleEnabled = false,
  otpChannels = [],
  defaultCountry = null,
}: LoginFormProps) {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  // Page the visitor came from (set by Sign in links and protected pages).
  const next = safeReturnTo(
    searchParams.get("next") ?? searchParams.get("callbackUrl"),
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [channel, setChannel] = useState<OtpChannel>(otpChannels[0] ?? "whatsapp");
  const fullPhone = country ? toE164(country, phone) : "";
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configError =
    authError === "Configuration"
      ? "Auth is misconfigured. Check AUTH_SECRET in Vercel."
      : authError === "AccessDenied"
        ? "Access denied."
        : authError
          ? `Sign-in error: ${authError}`
          : null;

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        throw new Error("Invalid email or password.");
      }
      // Hard navigation so the server header re-reads the session cookie.
      window.location.assign(next ?? "/admin");
      return;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, channel }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed");
      setStep("code");
      setMessage(
        json.data?.mock
          ? "Development mode: no message sent. Use code 000000."
          : channel === "whatsapp"
            ? `We sent a 6-digit code to ${fullPhone} on WhatsApp.`
            : `We sent a 6-digit code to ${fullPhone} by SMS.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await signIn("phone-otp", {
        phone: fullPhone,
        code,
        redirect: false,
      });
      if (result?.error) {
        throw new Error("That code didn't work. Check it, or ask for a new one.");
      }
      // Hard navigation so SessionProvider + header re-read the session.
      window.location.assign(next ?? "/");
      return;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {(configError || message) && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted">
          {configError ?? message}
        </p>
      )}

      <form onSubmit={loginWithPassword} className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Admin email login
        </p>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2"
          required
          autoComplete="username"
        />
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2"
          required
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Sign in
        </button>
        <p className="text-right text-xs">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
        </p>
      </form>

      <div className="border-t border-border pt-6 space-y-3">
        {googleEnabled ? (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: next ?? "/" })}
            className="flex w-full items-center justify-center rounded-sm border border-border bg-card px-4 py-3 text-sm font-medium text-primary"
          >
            Continue with Google
          </button>
        ) : null}

        {otpChannels.length ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Or sign in with a code
            </p>

            {step === "phone" ? (
              <form onSubmit={requestOtp} className="space-y-3">
                {otpChannels.length > 1 ? (
                  <div role="radiogroup" aria-label="Send the code by" className="grid grid-cols-2 gap-2">
                    {otpChannels.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={channel === c}
                        onClick={() => setChannel(c)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-sm font-medium transition",
                          channel === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-primary hover:border-accent",
                        )}
                      >
                        {c === "whatsapp" ? <WhatsAppIcon className="h-4 w-4" /> : null}
                        {c === "whatsapp" ? "WhatsApp" : "SMS"}
                      </button>
                    ))}
                  </div>
                ) : null}

                <PhoneInput
                  defaultCountry={defaultCountry}
                  country={country}
                  onCountryChange={setCountry}
                  value={phone}
                  onChange={setPhone}
                />

                <p className="text-xs leading-relaxed text-muted">
                  By clicking &quot;Send code&quot;, I agree to DM Global&apos;s{" "}
                  <Link href="/terms" className="underline underline-offset-2 hover:text-primary">
                    Terms of Service
                  </Link>{" "}
                  and acknowledge the{" "}
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-primary">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <button
                  type="submit"
                  disabled={loading || !fullPhone}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading
                    ? "Sending…"
                    : channel === "whatsapp"
                      ? "Send code on WhatsApp →"
                      : "Send code by SMS →"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-3">
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Verification code"
                  className="w-full rounded-sm border border-border bg-card px-4 py-3 text-center text-lg tracking-[0.4em] outline-none ring-accent focus:ring-2"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Verify & sign in
                </button>
                <button
                  type="button"
                  className="w-full text-xs text-muted"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setMessage(null);
                  }}
                >
                  Use a different number or channel
                </button>
              </form>
            )}
          </>
        ) : null}
      </div>

      <p className="text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href={authHref("/signup", next)} className="font-medium text-accent hover:underline">
          Create one
        </Link>
      </p>

      <p className="text-xs text-muted">
        Prefer browsing first?{" "}
        <Link href="/search" className="text-accent hover:underline">
          Start a search
        </Link>
      </p>
    </div>
  );
}
