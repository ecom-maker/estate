import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { isGoogleAuthEnabled } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Get started
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        Sign up with email and password
        {isGoogleAuthEnabled ? " or Google" : ""} to save searches and
        favourites.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <SignupForm googleEnabled={isGoogleAuthEnabled} />
      </Suspense>
    </div>
  );
}
