"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function EnquiryForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, comment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not send your enquiry.");
      }
      setStatus("sent");
      setName("");
      setContact("");
      setComment("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-sm border border-accent/30 bg-accent/5 p-4 text-sm text-primary">
        Thanks — your enquiry has been sent. We&apos;ll be in touch shortly.
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="ml-2 font-medium text-accent underline underline-offset-2"
        >
          Send another
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-primary outline-none transition focus:border-accent";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="Name"
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          type="tel"
          required
          minLength={5}
          maxLength={60}
          placeholder="Contact number"
          aria-label="Contact number"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className={inputClass}
        />
      </div>
      <textarea
        required
        minLength={2}
        maxLength={4000}
        rows={3}
        placeholder="Comment"
        aria-label="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className={`${inputClass} resize-y`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center rounded-sm bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
