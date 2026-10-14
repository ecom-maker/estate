"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authHref, safeReturnTo } from "@/lib/auth/return-to";
import { PhoneCodeForm, type OtpChannel } from "@/components/auth/phone-code-form";

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
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // While the code flow asks a new user for their name, hide everything else.
  const [collectingName, setCollectingName] = useState(false);

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

  return (
    <div className="mt-8 space-y-6">
      {(configError || message) && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted">
          {configError ?? message}
        </p>
      )}

      <div className="space-y-3">
        {otpChannels.length ? (
          <>
            {!collectingName ? (
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Or sign in with a code
              </p>
            ) : null}

            <PhoneCodeForm
              mode="login"
              otpChannels={otpChannels}
              defaultCountry={defaultCountry}
              next={next}
              onMessage={setMessage}
              onCollectingName={setCollectingName}
            />
          </>
        ) : null}

        {!collectingName && googleEnabled ? (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: next ?? "/" })}
            className="flex w-full items-center justify-center rounded-sm border border-border bg-card px-4 py-3 text-sm font-medium text-primary"
          >
            Continue with Google
          </button>
        ) : null}
      </div>

      {!collectingName ? (
      <form onSubmit={loginWithPassword} className="space-y-3 border-t border-border pt-6">
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
      ) : null}

      {!collectingName ? (
        <p className="text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href={authHref("/signup", next)} className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      ) : null}
    </div>
  );
}
