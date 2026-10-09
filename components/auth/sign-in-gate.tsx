"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, signIn, useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { authHref } from "@/lib/auth/return-to";

/**
 * "Sign in to continue" before a search or an AI chat question runs.
 *
 * People must be signed in first: Google One Tap offers their Google account
 * in one click (the card Google shows in the corner), with a "Sign in with
 * Google" button and other sign-in options as fallback. After One Tap the
 * search or question runs straight away; after another sign-in method they
 * come back to the same page and a pending chat question is sent then.
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

const PENDING_ASK_KEY = "dm:pending-ask";
const PENDING_ASK_TTL_MS = 30 * 60 * 1000;

const currentPath = () => `${window.location.pathname}${window.location.search}`;

function savePendingAsk(text: string) {
  try {
    sessionStorage.setItem(
      PENDING_ASK_KEY,
      JSON.stringify({ path: currentPath(), text, ts: Date.now() }),
    );
  } catch {
    // ignore (private mode / blocked storage)
  }
}

/** A chat question asked on this page before a redirect-based sign-in. */
export function takePendingAsk(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ASK_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { path?: string; text?: string; ts?: number };
    if (entry.path !== currentPath()) return null;
    sessionStorage.removeItem(PENDING_ASK_KEY);
    if (typeof entry.ts !== "number" || Date.now() - entry.ts > PENDING_ASK_TTL_MS) return null;
    return entry.text?.trim() || null;
  } catch {
    return null;
  }
}

export type RequireAuthOptions = {
  /** Where to land after a redirect-based sign-in (default: this page). */
  next?: string;
  /** Chat text to send when the visitor returns from a redirect-based sign-in. */
  pendingAsk?: string;
  title?: string;
  message?: string;
};

type Pending = RequireAuthOptions & { action: () => void; next: string; openedOn: string };

const RequireAuthContext = createContext<
  ((action: () => void, opts?: RequireAuthOptions) => Promise<void>) | null
>(null);

export function SignInGateProvider({
  googleClientId,
  children,
}: {
  googleClientId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, update } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);

  // Left the page (e.g. to /login): drop the gate so it can't reappear on Back.
  if (pending && pending.openedOn !== pathname) setPending(null);

  const requireAuth = useCallback(
    async (action: () => void, opts: RequireAuthOptions = {}) => {
      if (status === "authenticated" || isAutomated()) {
        action();
        return;
      }
      // Session may still be loading on first paint; ask once before gating.
      if (status === "loading" && (await getSession())?.user) {
        action();
        return;
      }
      setPending({ ...opts, action, next: opts.next ?? currentPath(), openedOn: window.location.pathname });
    },
    [status],
  );

  const onSignedIn = useCallback(async () => {
    const done = pending;
    setPending(null);
    // Refresh the session (header avatar) and server-rendered parts.
    await update();
    router.refresh();
    done?.action();
  }, [pending, update, router]);

  return (
    <RequireAuthContext.Provider value={requireAuth}>
      {children}
      {pending && pending.openedOn === pathname ? (
        <SignInGateDialog
          googleClientId={googleClientId}
          pending={pending}
          onSignedIn={onSignedIn}
          onClose={() => setPending(null)}
        />
      ) : null}
    </RequireAuthContext.Provider>
  );
}

/**
 * Runs `action` once the visitor is signed in: right away when they already
 * are (or are an automated browser), otherwise after the sign-in step.
 */
export function useRequireAuth() {
  const requireAuth = useContext(RequireAuthContext);
  // Outside the provider (tests, isolated renders) nothing is gated.
  return requireAuth ?? (async (action: () => void) => action());
}

function SignInGateDialog({
  googleClientId,
  pending,
  onSignedIn,
  onClose,
}: {
  googleClientId: string | null;
  pending: Pending;
  onSignedIn: () => void;
  onClose: () => void;
}) {
  const { next, pendingAsk } = pending;
  const buttonRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "signing-in" | "error">("idle");
  // Google's script can be blocked (ad blockers, strict privacy settings).
  const [gisFailed, setGisFailed] = useState(false);
  // Latest callback without re-initialising Google on every render.
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  // Leaving for a redirect-based sign-in: remember the chat question.
  const rememberAsk = useCallback(() => {
    if (pendingAsk) savePendingAsk(pendingAsk);
  }, [pendingAsk]);

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
            onSignedInRef.current();
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
  }, [googleClientId]);

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
          {pending.title ?? "Sign in to see results"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {pending.message ?? "It takes one tap with Google. We’ll take you straight to your search."}
        </p>

        <div className="mt-5 flex min-h-[44px] justify-center">
          {googleClientId && gisFailed ? (
            // Redirect-based Google sign-in, returning to the same place.
            <button
              type="button"
              onClick={() => {
                rememberAsk();
                void signIn("google", { callbackUrl: next });
              }}
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

        <GateLinks next={next} onLeave={rememberAsk}>
          {googleClientId ? "Other ways to sign in" : "Sign in"}
        </GateLinks>
      </div>
    </div>
  );
}

function GateLinks({
  next,
  onLeave,
  children,
}: {
  next: string;
  onLeave: () => void;
  children: ReactNode;
}) {
  return (
    <p className="mt-5 text-sm text-muted">
      <Link href={authHref("/login", next)} onClick={onLeave} className="font-medium text-accent hover:underline">
        {children}
      </Link>
      {" · "}
      <Link href={authHref("/signup", next)} onClick={onLeave} className="font-medium text-accent hover:underline">
        Create account
      </Link>
    </p>
  );
}
