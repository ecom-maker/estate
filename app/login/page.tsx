import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { isGoogleAuthEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Authentication
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Welcome back</h1>
      <p className="mt-3 text-sm text-muted">
        Sign in with email and password
        {isGoogleAuthEnabled ? ", Google," : ""} or phone OTP.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <LoginForm googleEnabled={isGoogleAuthEnabled} />
      </Suspense>
    </div>
  );
}
