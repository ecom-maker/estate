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
  onIntent?: (intentHeader: string | null) => void;
  onPropertyIds?: (ids: string[]) => void;
};

export function AIChat({
  placeholder = "Ask anything...",
  propertyId,
  className,
  initialMessages = [],
  autoSendOnMount,
  onIntent,
  onPropertyIds,
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

      const idsHeader = res.headers.get("X-Property-Ids");
      if (idsHeader) {
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
