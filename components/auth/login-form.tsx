"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type LoginFormProps = {
  googleEnabled?: boolean;
};

export function LoginForm({ googleEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configError =
    authError === "Configuration"
      ? "Auth is misconfigured. Use phone OTP for now, or set Google OAuth + AUTH_SECRET in Vercel."
      : authError === "AccessDenied"
        ? "Access denied."
        : authError
          ? `Sign-in error: ${authError}`
          : null;

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed");
      setStep("code");
      setMessage(
        json.data?.mock
          ? "Mock OTP sent. Use code 000000."
          : "OTP sent to your phone.",
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
        phone,
        code,
        redirect: false,
      });
      if (result?.error) {
        throw new Error(
          result.error === "Configuration"
            ? "Server auth misconfigured (check AUTH_SECRET / database)."
            : "Invalid code or database unavailable.",
        );
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      {(configError || message) && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted">
          {configError ?? message}
        </p>
      )}

      {googleEnabled ? (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          Continue with Google
        </button>
      ) : (
        <p className="text-xs text-muted">
          Google sign-in is not configured. Use phone OTP below (code{" "}
          <code>000000</code> in mock mode).
        </p>
      )}

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="space-y-3">
          <label htmlFor="phone" className="sr-only">
            Phone number
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 50 000 0000"
            className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm font-medium text-primary disabled:opacity-50"
          >
            Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-3">
          <label htmlFor="code" className="sr-only">
            OTP code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm font-medium text-primary disabled:opacity-50"
          >
            Verify & sign in
          </button>
          <button
            type="button"
            className="w-full text-xs text-muted"
            onClick={() => setStep("phone")}
          >
            Use a different number
          </button>
        </form>
      )}

      <p className="text-xs text-muted">
        Prefer browsing first?{" "}
        <Link href="/search" className="text-accent hover:underline">
          Start a search
        </Link>
      </p>
    </div>
  );
}
