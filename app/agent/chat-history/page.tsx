import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat History" };

function fmtWhen(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ChatHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fagent%2Fchat-history");

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      summary: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return (
    <AgentShell
      title="Chat History"
      subtitle={`${sessions.length} ${sessions.length === 1 ? "conversation" : "conversations"}.`}
    >
      {sessions.length === 0 ? (
        <EmptyState>
          No conversations yet. Chats with the assistant are saved here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/agent/chat-history/${s.id}`}
                className="block rounded-sm border border-border bg-card p-5 transition hover:border-accent"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="truncate font-serif text-lg text-primary">
                    {s.title || "Untitled conversation"}
                  </h2>
                  <span className="shrink-0 text-xs text-muted">
                    {fmtWhen(s.updatedAt)}
                  </span>
                </div>
                {s.summary ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {s.summary}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted">
                  {s._count.messages} message
                  {s._count.messages === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AgentShell>
  );
}
