"use client";

import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AIChatProps = {
  placeholder?: string;
  propertyId?: string;
  className?: string;
  initialMessages?: ChatMessage[];
  onIntent?: (intentHeader: string | null) => void;
};

export function AIChat({
  placeholder = "Ask anything...",
  propertyId,
  className,
  initialMessages = [],
  onIntent,
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
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
        }),
      });

      onIntent?.(res.headers.get("X-Search-Intent"));

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
        setMessages([...nextMessages, { role: "assistant", content: assistant }]);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className={cn("flex h-full min-h-[320px] flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          AI Assistant
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <p className="text-sm text-muted">
              Ask about inventory, yields, schools, or payment plans. I will not
              invent missing facts.
            </p>
          )}
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                message.role === "user"
                  ? "ml-8 bg-primary text-primary-foreground"
                  : "mr-4 bg-background text-foreground",
              )}
            >
              {message.content || (streaming ? "…" : "")}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border pt-3">
        <label htmlFor="ai-chat-input" className="sr-only">
          Message
        </label>
        <input
          id="ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={streaming}
          className="flex-1 rounded-sm border border-border bg-card px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="inline-flex items-center justify-center rounded-sm bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
