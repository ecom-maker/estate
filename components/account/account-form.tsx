"use client";

import { FormEvent, useState } from "react";

type AccountInitial = {
  name: string;
  email: string;
  phone: string;
  hasPassword: boolean;
};

export function AccountForm({ initial }: { initial: AccountInitial }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword) {
      if (newPassword.length < 8) {
        setMessage({ ok: false, text: "New password must be at least 8 characters." });
        return;
      }
      if (newPassword !== confirm) {
        setMessage({ ok: false, text: "New passwords do not match." });
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { name, email, phone };
      if (newPassword) {
        body.newPassword = newPassword;
        if (initial.hasPassword) body.currentPassword = currentPassword;
      }
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Update failed");

      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setMessage({ ok: true, text: "Profile updated." });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Update failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2";
  const labelCls = "block text-xs font-medium text-muted";

  return (
    <form onSubmit={save} className="mt-8 space-y-6">
      {message && (
        <p
          className={`rounded-sm border px-3 py-2 text-sm ${
            message.ok
              ? "border-accent/40 bg-accent/10 text-primary"
              : "border-border bg-card text-muted"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="name" className={labelCls}>Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} required autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${field}`} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="phone" className={labelCls}>Contact number</label>
          <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" className={`mt-1 ${field}`} autoComplete="tel" />
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {initial.hasPassword ? "Change password" : "Set a password"}
        </p>
        {initial.hasPassword ? (
          <div>
            <label htmlFor="currentPassword" className={labelCls}>Current password</label>
            <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={`mt-1 ${field}`} autoComplete="current-password" />
          </div>
        ) : null}
        <div>
          <label htmlFor="newPassword" className={labelCls}>New password</label>
          <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" className={`mt-1 ${field}`} autoComplete="new-password" minLength={8} />
        </div>
        <div>
          <label htmlFor="confirm" className={labelCls}>Confirm new password</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`mt-1 ${field}`} autoComplete="new-password" minLength={8} />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
