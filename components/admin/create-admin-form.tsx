"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAdminUser, type CreateAdminState } from "@/app/admin/users/actions";

const initial: CreateAdminState = {};

export function CreateAdminForm() {
  const [state, action, pending] = useActionState(createAdminUser, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const inputClass =
    "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-primary outline-none transition focus:border-accent";

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-sm border border-border bg-card p-5"
    >
      <h2 className="font-serif text-lg text-primary">Create admin user</h2>
      <p className="mt-1 text-sm text-muted">
        They can create and edit property listings. (Super Admin only.)
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name" aria-label="Name" className={inputClass} />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          aria-label="Email"
          className={inputClass}
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Temporary password (min 8)"
          aria-label="Password"
          className={inputClass}
        />
        <select name="role" aria-label="Role" defaultValue="COMPANY_ADMIN" className={inputClass}>
          <option value="COMPANY_ADMIN">Company Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      {state.error ? (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-green-700">Admin user created.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center rounded-sm bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create admin"}
      </button>
    </form>
  );
}
