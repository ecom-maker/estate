import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-28">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Authentication
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Welcome back</h1>
      <p className="mt-3 text-sm text-muted">
        Sign in with Google or phone OTP to save searches and favorites.
      </p>
      <LoginForm />
    </div>
  );
}
