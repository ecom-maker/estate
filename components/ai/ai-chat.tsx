"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeBase64UrlJson } from "@/lib/encoding";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AIChatProps = {
  placeholder?: string;
  propertyId?: string;
  className?: string;
  initialMessages?: ChatMessage[];
  autoSendOnMount?: string;
  whatsappNumber?: string;
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
  const autoSent = useRef(false);
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

  async function send(text: string, baseMessages?: ChatMessage[]) {
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
      onIntent?.(intentHeader);
      if (intentHeader) {
        const decoded = decodeBase64UrlJson<Record<string, unknown>>(intentHeader);
        if (decoded) setPreviousIntent(decoded);
      }

      // Header present but empty means "a search ran and matched nothing" —
      // still notify (with []) so the results grid clears instead of keeping
      // the previous search's cards. Only a missing header (null) is skipped.
      const idsHeader = res.headers.get("X-Property-Ids");
      if (idsHeader !== null) {
        onPropertyIds?.(idsHeader.split(",").filter(Boolean));
      }

      const nextSession = res.headers.get("X-Chat-Session");
      if (nextSession) setSessionId(nextSession);

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages([
          ...nextMessages,
          { role: "assistant", content: assistant },
        ]);
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
    void send(autoSendOnMount, []);
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
    const message = `Hi, I'd like more information about this property:\n${url}`;
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
      <div className="flex items-center gap-2 border-b border-border pb-3">
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
            aria-label="Share this property on WhatsApp"
            title="Share on WhatsApp"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#25D366] transition hover:bg-[#25D366]/10"
          >
            <WhatsAppIcon className="h-5 w-5" />
          </button>
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
              Ask about inventory, yields, schools, or payment plans. I won&apos;t
              invent missing facts.
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
                  {showTyping ? <TypingDots /> : message.content}
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
