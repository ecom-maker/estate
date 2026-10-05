"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, History, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeBase64UrlJson } from "@/lib/encoding";

/** End-of-turn metadata follows this character in agent replies (see lib/ai/agent/chat-stream.ts). */
const META_SEPARATOR = "";

type ChatMessage = { role: "user" | "assistant"; content: string };

type HistoryEntry = { id: string; title: string; updatedAt: number };

const HISTORY_KEY = "dmp_chat_history";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore (private mode / blocked storage)
  }
}

// --- Auto-send result cache ------------------------------------------------
// The /search page re-mounts the assistant with the URL query on every refresh
// and browser back/forward. Replaying that query would re-hit /api/chat (and,
// for non-search turns, the LLM) for a result the user already saw. We cache
// the completed turn per query in sessionStorage (tab-scoped, so it naturally
// clears when the tab closes) and replay it instead of re-requesting.
const AUTOSEND_CACHE_KEY = "dmp_autosend_cache";
// Cached turns expire after this long so a fix/new data deploy isn't masked by
// a stale replay. Entries written before this field existed are treated as
// expired too (no `ts`).
const AUTOSEND_TTL_MS = 60 * 60 * 1000; // 1 hour

type CachedTurn = {
  messages: ChatMessage[];
  propertyIds: string[] | null; // null = response had no property-ids header
  intent: Record<string, unknown> | null;
  sessionId?: string;
  ts: number; // when this turn was cached (Date.now())
};

function autoSendCacheKey(propertyId: string | undefined, query: string) {
  return `${propertyId ?? ""}::${query.trim()}`;
}

function readAutoSend(
  propertyId: string | undefined,
  query: string,
): CachedTurn | null {
  try {
    const raw = sessionStorage.getItem(AUTOSEND_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, CachedTurn>;
    const entry = map[autoSendCacheKey(propertyId, query)];
    if (!entry) return null;
    // Expired (or legacy entry without a timestamp) — drop it and miss.
    if (typeof entry.ts !== "number" || Date.now() - entry.ts > AUTOSEND_TTL_MS) {
      delete map[autoSendCacheKey(propertyId, query)];
      sessionStorage.setItem(AUTOSEND_CACHE_KEY, JSON.stringify(map));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeAutoSend(
  propertyId: string | undefined,
  query: string,
  turn: Omit<CachedTurn, "ts">,
) {
  try {
    const raw = sessionStorage.getItem(AUTOSEND_CACHE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, CachedTurn>;
    const now = Date.now();
    // Drop expired entries before adding the new one.
    for (const [k, v] of Object.entries(map)) {
      if (typeof v.ts !== "number" || now - v.ts > AUTOSEND_TTL_MS) delete map[k];
    }
    map[autoSendCacheKey(propertyId, query)] = { ...turn, ts: now };
    // Keep the cache bounded — keep the most recently cached entries.
    const keys = Object.keys(map).sort((a, b) => (map[a].ts ?? 0) - (map[b].ts ?? 0));
    if (keys.length > 30) {
      for (const k of keys.slice(0, keys.length - 30)) delete map[k];
    }
    sessionStorage.setItem(AUTOSEND_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore (private mode / blocked / quota)
  }
}

type AIChatProps = {
  placeholder?: string;
  propertyId?: string;
  className?: string;
  initialMessages?: ChatMessage[];
  autoSendOnMount?: string;
  whatsappNumber?: string;
  showHistory?: boolean;
  onIntent?: (intentHeader: string | null) => void;
  onPropertyIds?: (ids: string[]) => void;
  onStreaming?: (streaming: boolean) => void;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.9 11.9 0 005.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.893a11.821 11.821 0 00-3.48-8.464z" />
    </svg>
  );
}

export function AIChat({
  placeholder = "Ask anything...",
  propertyId,
  className,
  initialMessages = [],
  autoSendOnMount,
  whatsappNumber,
  showHistory = false,
  onIntent,
  onPropertyIds,
  onStreaming,
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.filter((m) => m.role === "assistant" || !autoSendOnMount),
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [previousIntent, setPreviousIntent] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const autoSent = useRef(false);

  // Record / update a session, merging with what's already in localStorage so
  // nothing is lost even if the in-memory list wasn't loaded yet.
  function recordSession(id: string, title: string) {
    const current = loadHistory();
    const next = [
      { id, title: title.slice(0, 80), updatedAt: Date.now() },
      ...current.filter((e) => e.id !== id),
    ].slice(0, 50);
    saveHistory(next);
    setHistory(next);
  }

  function toggleHistory() {
    if (!historyOpen) setHistory(loadHistory());
    setHistoryOpen((v) => !v);
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
    setSessionId(undefined);
    setPreviousIntent(null);
    setHistoryOpen(false);
  }

  // Restore a previously-cached auto-send turn (refresh / browser back) without
  // calling the API. Kept as its own function so the mount effect never calls
  // setState synchronously in its body.
  function hydrateFromCache(cached: CachedTurn) {
    setMessages(cached.messages);
    setPreviousIntent(cached.intent);
    if (cached.sessionId) setSessionId(cached.sessionId);
    if (cached.propertyIds !== null) onPropertyIds?.(cached.propertyIds);
  }

  async function openSession(id: string) {
    setHistoryOpen(false);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`);
      const json = await res.json();
      if (!json.success) return;
      const d = json.data as {
        id: string;
        messages: ChatMessage[];
        lastIntent: Record<string, unknown> | null;
        lastPropertyIds: string[];
      };
      setMessages(d.messages);
      setSessionId(d.id);
      setPreviousIntent(d.lastIntent ?? null);
      if (d.lastPropertyIds?.length) onPropertyIds?.(d.lastPropertyIds);
    } catch {
      // ignore
    }
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the conversation pinned to the latest message (like Claude / ChatGPT).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Auto-grow the composer to fit its content (capped); resets when cleared.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function send(
    text: string,
    baseMessages?: ChatMessage[],
    cacheKey?: string,
  ) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history = baseMessages ?? messages;
    const nextMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    onStreaming?.(true);
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          propertyId,
          sessionId,
          previousIntent: previousIntent ?? undefined,
        }),
      });

      const intentHeader = res.headers.get("X-Search-Intent");
      let turnIntent: Record<string, unknown> | null = previousIntent;
      onIntent?.(intentHeader);
      if (intentHeader) {
        const decoded = decodeBase64UrlJson<Record<string, unknown>>(intentHeader);
        if (decoded) {
          setPreviousIntent(decoded);
          turnIntent = decoded;
        }
      }

      // Header present but empty means "a search ran and matched nothing" —
      // still notify (with []) so the results grid clears instead of keeping
      // the previous search's cards. Only a missing header (null) is skipped.
      const idsHeader = res.headers.get("X-Property-Ids");
      let turnIds = idsHeader !== null ? idsHeader.split(",").filter(Boolean) : null;
      if (turnIds !== null) {
        onPropertyIds?.(turnIds);
      }

      const nextSession = res.headers.get("X-Chat-Session");
      if (nextSession) {
        setSessionId(nextSession);
        // Title the session by its first user message.
        if (showHistory) {
          const firstUser = nextMessages.find((m) => m.role === "user");
          recordSession(nextSession, firstUser?.content ?? trimmed);
        }
      }

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let assistant = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        assistant = raw.split(META_SEPARATOR)[0];
        setMessages([
          ...nextMessages,
          { role: "assistant", content: assistant },
        ]);
      }

      // Agent replies end with a metadata trailer instead of headers: the
      // properties to show and the search criteria, decided after its tools ran.
      const sep = raw.indexOf(META_SEPARATOR);
      if (sep !== -1) {
        try {
          const meta = JSON.parse(raw.slice(sep + 1)) as {
            propertyIds?: string[];
            intent?: Record<string, unknown> | null;
          };
          if (meta.propertyIds) {
            turnIds = meta.propertyIds;
            onPropertyIds?.(meta.propertyIds);
          }
          if (meta.intent) {
            turnIntent = meta.intent;
            setPreviousIntent(meta.intent);
          }
        } catch {
          // malformed trailer: keep the text, skip the extras
        }
      }

      // Cache the completed turn so a refresh / browser-back replays it from
      // storage instead of re-hitting the API (and any LLM cost).
      if (cacheKey) {
        writeAutoSend(propertyId, cacheKey, {
          messages: [...nextMessages, { role: "assistant", content: assistant }],
          propertyIds: turnIds,
          intent: turnIntent,
          sessionId: nextSession ?? sessionId,
        });
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "Something went wrong generating a response. Please try again.",
        },
      ]);
    } finally {
      setStreaming(false);
      onStreaming?.(false);
    }
  }

  useEffect(() => {
    if (!autoSendOnMount || autoSent.current) return;
    autoSent.current = true;

    // On refresh / browser back, replay the cached turn instead of re-running
    // the query against the API — the user already paid for this result.
    const cached = readAutoSend(propertyId, autoSendOnMount);
    if (cached) {
      // One-time restore of prior results from sessionStorage (an external
      // system) — the intended use of an effect, not a derived-state loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      hydrateFromCache(cached);
      return;
    }

    void send(autoSendOnMount, [], autoSendOnMount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendOnMount]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const isEmpty = messages.length === 0;

  function shareOnWhatsApp() {
    if (typeof window === "undefined" || !whatsappNumber) return;
    const url = window.location.href;
    // Property pages reference the specific listing; browse pages send a
    // general enquiry with the page they were looking at.
    const message = propertyId
      ? `Hi, I'd like more information about this property:\n${url}`
      : `Hi, I'd like help finding a property on DM Global.\n${url}`;
    const number = whatsappNumber.replace(/[^\d]/g, "");
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Header */}
      <div className="relative flex items-center gap-2 border-b border-border pb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15">
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          AI Assistant
        </p>

        {whatsappNumber ? (
          <button
            type="button"
            onClick={shareOnWhatsApp}
            aria-label="Chat on WhatsApp about this property"
            title="Chat on WhatsApp"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1ebe5d]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Chat on WhatsApp
          </button>
        ) : null}

        {showHistory ? (
          <div className={cn("flex items-center gap-1", whatsappNumber ? "" : "ml-auto")}>
            <span className="group relative">
              <button
                type="button"
                onClick={startNewChat}
                aria-label="New chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-accent/10 hover:text-accent"
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <Tooltip>New chat</Tooltip>
            </span>
            <span className="group relative">
              <button
                type="button"
                onClick={toggleHistory}
                aria-label="Chat history"
                aria-expanded={historyOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-accent/10 hover:text-accent"
              >
                <History className="h-4 w-4" />
              </button>
              <Tooltip>Chat history</Tooltip>
            </span>
          </div>
        ) : null}

        {showHistory && historyOpen ? (
          <div className="absolute right-0 top-full z-30 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border border-border bg-card p-1.5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            {history.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted">
                No past chats yet.
              </p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openSession(h.id)}
                  className={cn(
                    "block w-full truncate rounded-sm px-3 py-2 text-left text-sm transition hover:bg-accent/10",
                    h.id === sessionId ? "text-accent" : "text-primary",
                  )}
                  title={h.title}
                >
                  {h.title}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto py-5 pr-1",
          isEmpty ? "flex flex-col items-center justify-center" : "space-y-5",
        )}
        aria-live="polite"
      >
        {isEmpty && (
          <div className="flex flex-col items-center px-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
            </span>
            <p className="mt-3 font-serif text-lg text-primary">How can I help?</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              Tell me what you&apos;re looking for, or ask about any project,
              price, payment plan or handover. I only use verified data.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLast = index === messages.length - 1;
            const showTyping = !isUser && isLast && streaming && !message.content;
            return (
              <motion.div
                key={`${message.role}-${index}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                {!isUser && (
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                  </span>
                )}
                <div
                  className={cn(
                    "text-sm leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground"
                      : "max-w-[85%] pt-0.5 text-foreground",
                  )}
                >
                  {showTyping ? (
                    <TypingDots />
                  ) : isUser ? (
                    message.content
                  ) : (
                    <RichText text={message.content} />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-border pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 transition focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <label htmlFor="ai-chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="ai-chat-input"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={streaming}
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
}

/**
 * Assistant text with the little formatting the agent uses: [label](url)
 * links, bare URLs and **bold**. Everything else stays plain text (React
 * escapes it), so model output can never inject markup.
 */
function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|\*\*([^*]+)\*\*/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[4] != null) {
      parts.push(<strong key={key++}>{m[4]}</strong>);
    } else {
      const href = m[2] ?? m[3];
      const label = m[1] ?? m[3];
      const internal =
        href.startsWith("/") ||
        (typeof window !== "undefined" && href.startsWith(window.location.origin));
      parts.push(
        <a
          key={key++}
          href={href}
          {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
        >
          {label}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Instant, styled hover/focus tooltip for the header icon buttons. */
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {children}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
