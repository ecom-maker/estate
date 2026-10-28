"use client";

import { useEffect, useRef, useState } from "react";

const MCP_URL = "https://dmglobal.me/api/mcp";

/**
 * A "Connect your AI" button that opens a popover with the MCP server URL, a
 * one-click copy button, and a short hint on how to add it in Claude.
 */
export function ConnectMcp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function copy() {
    void navigator.clipboard?.writeText(MCP_URL).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:border-white/50 hover:bg-white/15"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Connect your AI
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Connect your AI assistant"
          className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-xl border border-black/10 bg-white p-4 text-left shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
        >
          <p className="text-sm font-semibold text-slate-900">
            Connect DM Global to your AI
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Give Claude, or any MCP-compatible assistant, live access to our
            property data. Copy this server URL:
          </p>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
            <code className="flex-1 truncate px-1.5 font-mono text-xs text-slate-700">
              {MCP_URL}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            In Claude, go to <strong className="text-slate-700">Settings → Connectors → Add custom connector</strong>,
            paste the URL, and approve the sign-in.
          </p>
        </div>
      ) : null}
    </div>
  );
}
