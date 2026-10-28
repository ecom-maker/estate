"use client";

import { useRef, useState } from "react";

const MCP_URL = "https://dmglobal.me/api/mcp";

/**
 * A copyable link to the DM Global MCP server, for people who want to connect
 * their AI assistant (Claude, etc.) to our property data.
 */
export function ConnectMcp() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy() {
    void navigator.clipboard?.writeText(MCP_URL).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
        Connect your AI
      </span>
      <button
        type="button"
        onClick={copy}
        title="Copy the MCP server URL"
        aria-label="Copy the MCP server URL"
        className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-xs text-white backdrop-blur transition hover:border-white/50 hover:bg-white/15"
      >
        <span>{MCP_URL}</span>
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      {copied ? <span className="text-xs text-white/70">Copied</span> : null}
    </div>
  );
}
