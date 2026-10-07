"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { phoneError } from "@/lib/validation/phone";

type Status = "idle" | "submitting" | "done" | "error";

export function SellModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  // Phone feedback appears once the field is left (or on submit), not mid-typing.
  const [contactTouched, setContactTouched] = useState(false);
  const contactRef = useRef<HTMLInputElement>(null);
  const contactError = contactTouched ? phoneError(contact) : null;

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phoneError(contact)) {
      setContactTouched(true);
      contactRef.current?.focus();
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, description }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Submission failed");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
  const labelClass =
    "text-[11px] font-medium uppercase tracking-wider text-muted";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sell your property"
    >
      <div
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-sm border border-border bg-card p-6 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted transition hover:text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "done" ? (
          <div className="py-6 text-center">
            <h2 className="font-serif text-2xl text-primary">Thank you!</h2>
            <p className="mt-2 text-sm text-muted">
              Your details have been received. Our team will reach out to you
              shortly about selling your property.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
              Sell with us
            </p>
            <h2 className="mt-2 font-serif text-2xl text-primary">
              List your property
            </h2>
            <p className="mt-1 text-sm text-muted">
              Share a few details and our team will get in touch.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="sell-name" className={labelClass}>
                  Name *
                </label>
                <input
                  id="sell-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="sell-contact" className={labelClass}>
                  Contact number *
                </label>
                <input
                  ref={contactRef}
                  id="sell-contact"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={60}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onBlur={() => setContactTouched(true)}
                  aria-invalid={contactError ? true : undefined}
                  aria-describedby={contactError ? "sell-contact-error" : undefined}
                  placeholder="+971 5X XXX XXXX"
                  className={
                    contactError
                      ? fieldClass.replace("ring-accent", "border-red-600 ring-red-600")
                      : fieldClass
                  }
                />
                {contactError ? (
                  <p id="sell-contact-error" className="mt-1 text-xs text-red-600">
                    {contactError}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="sell-desc" className={labelClass}>
                  Property description *
                </label>
                <textarea
                  id="sell-desc"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Type, location, size, bedrooms, condition, asking price…"
                  className={`${fieldClass} resize-none`}
                />
              </div>

              {status === "error" ? (
                <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex w-full items-center justify-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
