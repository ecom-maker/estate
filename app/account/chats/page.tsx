import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "My chats" };

/** "2h ago", "3d ago", or a date for older items. */
function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Strip markdown so the preview reads as plain text. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function MyChatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Faccount%2Fchats");

  const chats = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      channel: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      messages: {
        where: { role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Account
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">My chats</h1>
      <p className="mt-3 text-sm text-muted">
        Your conversations with the DM Global assistant. Open one to pick up
        where you left off.
      </p>

      {chats.length === 0 ? (
        <div className="mt-10 rounded-sm border border-border bg-card p-8 text-center">
          <MessageSquare
            className="mx-auto h-6 w-6 text-muted"
            aria-hidden
          />
          <p className="mt-3 text-sm text-muted">
            No chats yet. Ask the assistant anything about a property or project
            and it will show up here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start a chat
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {chats.map((chat) => {
            const preview = chat.messages[0]?.content
              ? plain(chat.messages[0].content)
              : "";
            return (
              <li key={chat.id}>
                <Link
                  href={`/account/chats/${chat.id}`}
                  className="group flex flex-col gap-1 rounded-sm border border-border bg-card px-4 py-3 transition hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-primary">
                      {chat.title || "Untitled chat"}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {timeAgo(chat.updatedAt)}
                    </span>
                  </div>
                  {preview ? (
                    <span className="truncate text-xs text-muted">{preview}</span>
                  ) : null}
                  <span className="text-[11px] uppercase tracking-wider text-muted/70">
                    {chat._count.messages} message
                    {chat._count.messages === 1 ? "" : "s"}
                    {chat.channel === "whatsapp" ? " · WhatsApp" : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
