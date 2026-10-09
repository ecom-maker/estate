"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { authHref } from "@/lib/auth/return-to";

/**
 * "Sign in to continue" for home-page searches.
 *
 * People must be signed in before results open: Google One Tap offers their
 * Google account in one click (the card Google shows in the corner), with a
 * "Sign in with Google" button and other sign-in options as fallback. Once
 * signed in, they land on the search they asked for.
 *
 * Only this UI step is gated. /search, the data API and the A2A endpoint stay
 * open, so AI agents and crawlers are never asked to sign in, and automated
 * browsers (navigator.webdriver) skip the gate too.
 */

type GoogleId = {
  initialize: (opts: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGis(): Promise<GoogleId | null> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve(window.google?.accounts?.id ?? null));
    s.addEventListener("error", () => resolve(null));
    if (!existing) {
      s.src = GIS_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

const isAutomated = () => typeof navigator !== "undefined" && navigator.webdriver === true;

export function useSignInGate(googleClientId: string | null) {
  const router = useRouter();
  const { status } = useSession();
  const [next, setNext] = useState<string | null>(null);

  const guard = useCallback(
    async (url: string) => {
      if (status === "authenticated" || isAutomated()) {
        router.push(url);
        return;
      }
      // Session may still be loading on first paint; ask once before gating.
      if (status === "loading" && (await getSession())?.user) {
        router.push(url);
        return;
      }
      setNext(url);
    },
    [router, status],
  );

  const gate = next ? (
    <SignInGateDialog googleClientId={googleClientId} next={next} onClose={() => setNext(null)} />
  ) : null;

  return { guard, gate };
}

function SignInGateDialog({
  googleClientId,
  next,
  onClose,
}: {
  googleClientId: string | null;
  next: string;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "signing-in" | "error">("idle");
  // Google's script can be blocked (ad blockers, strict privacy settings).
  const [gisFailed, setGisFailed] = useState(false);

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;
    let gis: GoogleId | null = null;
    loadGis().then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setGisFailed(true);
        return;
      }
      gis = loaded;
      gis.initialize({
        client_id: googleClientId,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        context: "signin",
        callback: async ({ credential }: { credential?: string }) => {
          if (!credential) return;
          setState("signing-in");
          const res = await signIn("google-one-tap", { credential, redirect: false });
          if (res?.ok && !res.error) {
            // Full navigation so the header and session pick up the sign-in.
            window.location.assign(next);
          } else {
            setState("error");
          }
        },
      });
      // One Tap card (top corner), plus a regular button in case it's suppressed.
      gis.prompt();
      if (buttonRef.current) {
        gis.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 300,
        });
      }
    });
    return () => {
      cancelled = true;
      gis?.cancel();
    };
  }, [googleClientId, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-gate-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-sm bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1 text-muted transition hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="signin-gate-title" className="font-serif text-2xl text-primary">
          Sign in to see results
        </h2>
        <p className="mt-2 text-sm text-muted">
          It takes one tap with Google. We&apos;ll take you straight to your search.
        </p>

        <div className="mt-5 flex min-h-[44px] justify-center">
          {googleClientId && gisFailed ? (
            // Redirect-based Google sign-in, returning to the same search.
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: next })}
              className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-primary transition hover:border-accent"
            >
              Continue with Google
            </button>
          ) : googleClientId ? (
            <div ref={buttonRef} />
          ) : null}
        </div>
        {state === "signing-in" ? <p className="mt-3 text-sm text-muted">Signing you in…</p> : null}
        {state === "error" ? (
          <p className="mt-3 text-sm text-red-600">Google sign-in didn&apos;t complete. Try again or use another option.</p>
        ) : null}

        <GateLinks next={next}>
          {googleClientId ? "Other ways to sign in" : "Sign in"}
        </GateLinks>
      </div>
    </div>
  );
}

function GateLinks({ next, children }: { next: string; children: ReactNode }) {
  return (
    <p className="mt-5 text-sm text-muted">
      <Link href={authHref("/login", next)} className="font-medium text-accent hover:underline">
        {children}
      </Link>
      {" · "}
      <Link href={authHref("/signup", next)} className="font-medium text-accent hover:underline">
        Create account
      </Link>
    </p>
  );
}
