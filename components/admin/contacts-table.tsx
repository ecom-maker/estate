"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type ContactRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  interactionCount: number;
  lastContact: string;
};

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    const digits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      const inName = (r.name ?? "").toLowerCase().includes(query);
      const inEmail = (r.email ?? "").toLowerCase().includes(query);
      const inPhone =
        digits.length > 0 &&
        (r.phone ?? "").replace(/\D/g, "").includes(digits);
      return inName || inEmail || inPhone;
    });
  }, [q, rows]);

  return (
    <>
      <div className="mt-6 relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, number or email"
          aria-label="Search contacts"
          className="w-full rounded-sm border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-primary outline-none transition focus:border-accent"
        />
      </div>
      {q.trim() ? (
        <p className="mt-2 text-xs text-muted">
          {filtered.length} of {rows.length} shown
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Number</th>
              <th>Email</th>
              <th>Interactions</th>
              <th className="px-4">Last contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-accent/5">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/contacts/${c.id}`}
                    className="font-medium text-primary hover:text-accent"
                  >
                    {c.name || "Unknown"}
                  </Link>
                </td>
                <td>{c.phone || "—"}</td>
                <td className="max-w-[220px] truncate">{c.email || "—"}</td>
                <td>{c.interactionCount}</td>
                <td className="px-4 text-muted">{c.lastContact}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-4 py-6 text-muted">
                  {rows.length === 0
                    ? "No contacts yet. They appear once someone chats, enquires, or is saved as a lead."
                    : "No contacts match your search."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
