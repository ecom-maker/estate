import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversation" };

type Props = { params: Promise<{ id: string }> };

export default async function ChatHistoryDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/agent/chat-history/${id}`)}`);
  }

  const chat = await prisma.chatSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  // Only the owner can view their conversation.
  if (!chat || chat.userId !== session.user.id) notFound();

  return (
    <AgentShell
      title={chat.title || "Conversation"}
      subtitle={`${chat.messages.length} message${chat.messages.length === 1 ? "" : "s"}.`}
    >
      {chat.messages.length === 0 ? (
        <EmptyState>This conversation has no messages.</EmptyState>
      ) : (
        <div className="space-y-4">
          {chat.messages.map((m) => {
            const isUser = m.role === "USER";
            return (
              <div
                key={m.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-primary",
                  )}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AgentShell>
  );
}
