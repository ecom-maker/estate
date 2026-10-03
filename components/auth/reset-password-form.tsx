"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Reset failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="mt-8 rounded-sm border border-border bg-card px-4 py-3 text-sm text-muted">
        This reset link is missing its token.{" "}
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div className="mt-8 space-y-4">
        <p className="rounded-sm border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-primary">
          Your password has been reset. You can now sign in with your new
          password.
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2";

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      {error && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted">
          {error}
        </p>
      )}
      <label htmlFor="password" className="sr-only">
        New password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 8 characters)"
        className={field}
        required
        autoComplete="new-password"
        minLength={8}
      />
      <label htmlFor="confirm" className="sr-only">
        Confirm new password
      </label>
      <input
        id="confirm"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        className={field}
        required
        autoComplete="new-password"
        minLength={8}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
