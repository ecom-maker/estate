"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Request failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="mt-8 rounded-sm border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-primary">
        If an account exists for <strong>{email}</strong>, a password reset link
        is on its way. Check your inbox (and spam). The link expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      {error && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted">
          {error}
        </p>
      )}
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
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
