import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat" };

/**
 * Render assistant markdown (links + **bold**) as safe React nodes — no raw
 * HTML. Mirrors the inline formatting used in the live chat bubble.
 */
function renderRich(text: string, keyPrefix: string) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) {
      nodes.push(
        <a
          key={`${keyPrefix}-l${i}`}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline underline-offset-2"
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[3]}</strong>);
    }
    last = pattern.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default async function ChatTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?error=AccessDenied");
  const { id } = await params;

  const chat = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        where: { role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  // Owner-only: never expose another user's (or an anonymous) conversation.
  if (!chat || chat.userId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <Link
        href="/account/chats"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All chats
      </Link>

      <h1 className="mt-4 font-serif text-3xl text-primary">
        {chat.title || "Chat"}
      </h1>
      <p className="mt-1 text-xs text-muted">
        {chat.createdAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {chat.channel === "whatsapp" ? " · WhatsApp" : ""}
      </p>

      <div className="mt-8 space-y-4">
        {chat.messages.map((m) => {
          const isUser = m.role === "USER";
          return (
            <div
              key={m.id}
              className={isUser ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  isUser
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 text-sm text-primary"
                }
              >
                {m.content.split("\n").map((line, idx) => (
                  <Fragment key={idx}>
                    {idx > 0 ? <br /> : null}
                    {renderRich(line, `${m.id}-${idx}`)}
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
        {chat.messages.length === 0 ? (
          <p className="text-sm text-muted">This chat has no messages.</p>
        ) : null}
      </div>
    </div>
  );
}
