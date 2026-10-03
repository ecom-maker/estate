import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Account recovery
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Forgot password</h1>
      <p className="mt-3 text-sm text-muted">
        Enter your registered email and we&apos;ll send you a link to reset your
        password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
