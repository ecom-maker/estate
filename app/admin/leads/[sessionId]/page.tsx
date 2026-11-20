import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead conversation" };

type Props = { params: Promise<{ sessionId: string }> };

/**
 * Admin-scoped transcript viewer for a lead's conversation. Unlike the
 * end-user viewer at /agent/chat-history/[id] (which only lets a chat's own
 * owner read it), this is authorised on the admin's `customers.view`
 * permission, so staff can open a lead's chat regardless of who — or whether
 * anyone — owns the session. WhatsApp sessions in particular have no `userId`,
 * so the owner-scoped viewer always 404s them; this one does not.
 */
export default async function AdminLeadConversationPage({ params }: Props) {
  try {
    await assertPermission("customers.view");
  } catch {
    const { sessionId } = await params;
    redirect(`/login?next=/admin/leads/${sessionId}`);
  }

  const { sessionId } = await params;
  const chat = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) notFound();

  const meta = [
    chat.channel?.toUpperCase(),
    chat.phone ? `+${chat.phone}` : null,
    chat.createdAt.toISOString().slice(0, 16).replace("T", " "),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link
        href="/admin/leads"
        className="text-xs font-medium uppercase tracking-[0.25em] text-accent hover:underline"
      >
        ← Admin · Leads
      </Link>
      <h1 className="mt-3 font-serif text-3xl text-primary">
        {chat.title || "Conversation"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {meta.join(" · ")} · {chat.messages.length} message
        {chat.messages.length === 1 ? "" : "s"}
      </p>

      <div className="mt-8 space-y-4">
        {chat.messages.length === 0 ? (
          <p className="rounded-sm border border-border bg-card px-4 py-6 text-center text-sm text-muted">
            This conversation has no messages.
          </p>
        ) : (
          chat.messages.map((m) => {
            if (m.role === "SYSTEM") {
              return (
                <p
                  key={m.id}
                  className="text-center text-[11px] uppercase tracking-wider text-muted/70"
                >
                  {m.content}
                </p>
              );
            }
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
          })
        )}
      </div>
    </div>
  );
}
