"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { PhoneInput } from "@/components/auth/phone-input";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toE164, type Country } from "@/lib/phone/countries";
import { cn } from "@/lib/utils";

export type OtpChannel = "whatsapp" | "sms";

/** Matches the server's wait between codes to the same number (otp-store). */
const RESEND_AFTER_S = 30;

const fieldCls =
  "w-full rounded-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-accent focus:ring-2";

type PhoneCodeFormProps = {
  /** signup asks for the name up front; login asks only when the account has none. */
  mode: "login" | "signup";
  otpChannels: OtpChannel[];
  /** Visitor's country from their IP (ISO code), used for the phone picker. */
  defaultCountry?: string | null;
  next?: string | null;
  /** Status and errors are shown in the parent's message box. */
  onMessage: (message: string | null) => void;
  /** True while the post-sign-in "what's your name?" step is showing, so the
   *  parent can hide the other sign-in options. */
  onCollectingName?: (collecting: boolean) => void;
};

/**
 * Sign in with a one-time code sent to a phone: number → code → name (only
 * for a number we don't have a name for yet). A known number signs in to its
 * account and keeps the name it already has; a new number gets an account.
 */
export function PhoneCodeForm({
  mode,
  otpChannels,
  defaultCountry = null,
  next = null,
  onMessage,
  onCollectingName,
}: PhoneCodeFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [channel, setChannel] = useState<OtpChannel>(otpChannels[0] ?? "whatsapp");
  const fullPhone = country ? toE164(country, phone) : "";
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "name">("phone");
  const [loading, setLoading] = useState(false);
  /** Seconds until "Resend code" unlocks. */
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Let the parent collapse the other sign-in options during the name step.
  useEffect(() => {
    onCollectingName?.(step === "name");
  }, [step, onCollectingName]);

  // Hard navigation so SessionProvider + header re-read the session.
  const finish = () => window.location.assign(next ?? "/");

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    await sendCode(false);
  }

  async function sendCode(resend: boolean) {
    setLoading(true);
    onMessage(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, channel }),
      });
      const json = await res.json();
      if (!json.success) {
        // A failed send leaves no code behind, so the next try can go straight away.
        if (json.error?.code !== "TOO_SOON") setResendIn(0);
        throw new Error(json.error?.message ?? "Failed");
      }
      setStep("code");
      setCode("");
      setResendIn(RESEND_AFTER_S);
      onMessage(
        json.data?.mock
          ? "Development mode: no message sent. Use code 000000."
          : `We sent ${resend ? "a new" : "a"} 6-digit code to ${fullPhone} ${
              channel === "whatsapp" ? "on WhatsApp" : "by SMS"
            }.${resend ? " Only the newest code works." : ""}`,
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    onMessage(null);
    try {
      const result = await signIn("phone-otp", {
        phone: fullPhone,
        code,
        name: mode === "signup" ? name.trim() : "",
        redirect: false,
      });
      if (result?.error) {
        throw new Error("That code didn't work or has expired. Check it, or tap Resend code.");
      }
      // A new number has no name yet: ask for it once before going on.
      const session = await getSession();
      if (!session?.user?.name) {
        setStep("name");
        onMessage("You're signed in. One last step: what's your name?");
        return;
      }
      finish();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    onMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Couldn't save your name");
      finish();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Couldn't save your name");
    } finally {
      setLoading(false);
    }
  }

  const nameInput = (
    <>
      <label htmlFor="phone-name" className="sr-only">
        Full name
      </label>
      <input
        id="phone-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className={fieldCls}
        required
        maxLength={120}
        autoComplete="name"
      />
    </>
  );

  if (step === "name") {
    return (
      <form onSubmit={saveName} className="space-y-3">
        {nameInput}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyOtp} className="space-y-3">
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Verification code"
          className="w-full rounded-sm border border-border bg-card px-4 py-3 text-center text-lg tracking-[0.4em] outline-none ring-accent focus:ring-2"
          required
        />
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {mode === "signup" ? "Verify & create account" : "Verify & sign in"}
        </button>
        <button
          type="button"
          disabled={loading || resendIn > 0}
          onClick={() => sendCode(true)}
          className="w-full text-sm font-medium text-accent hover:underline disabled:text-muted disabled:no-underline"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Didn't get it? Resend code"}
        </button>
        <button
          type="button"
          className="w-full text-xs text-muted"
          onClick={() => {
            setStep("phone");
            setCode("");
            onMessage(null);
          }}
        >
          Use a different number or channel
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestOtp} className="space-y-3">
      {mode === "signup" ? nameInput : null}

      {otpChannels.length > 1 ? (
        <div role="radiogroup" aria-label="Send the code by" className="grid grid-cols-2 gap-2">
          {otpChannels.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              onClick={() => setChannel(c)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-sm font-medium transition",
                channel === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-primary hover:border-accent",
              )}
            >
              {c === "whatsapp" ? <WhatsAppIcon className="h-4 w-4" /> : null}
              {c === "whatsapp" ? "WhatsApp" : "SMS"}
            </button>
          ))}
        </div>
      ) : null}

      <PhoneInput
        defaultCountry={defaultCountry}
        country={country}
        onCountryChange={setCountry}
        value={phone}
        onChange={setPhone}
      />

      <p className="text-xs leading-relaxed text-muted">
        By clicking &quot;Send code&quot;, I agree to DM Global&apos;s{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-primary">
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-primary">
          Privacy Policy
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={loading || !fullPhone || (mode === "signup" && !name.trim())}
        className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {loading
          ? "Sending…"
          : channel === "whatsapp"
            ? "Send code on WhatsApp →"
            : "Send code by SMS →"}
      </button>
    </form>
  );
}
