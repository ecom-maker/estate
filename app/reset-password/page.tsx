import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Account recovery
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Choose a new password</h1>
      <p className="mt-3 text-sm text-muted">
        Enter a new password for your account.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
