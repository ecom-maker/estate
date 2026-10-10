import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertPermission } from "@/lib/rbac/guards";
import { getContactById, type InteractionType } from "@/lib/admin/contacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact history" };

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABEL: Record<InteractionType, string> = {
  whatsapp: "WhatsApp",
  web: "Website chat",
  lead: "Lead",
  enquiry: "Enquiry",
};

const TYPE_STYLE: Record<InteractionType, string> = {
  whatsapp: "bg-[#25D366]/15 text-[#128C4A]",
  web: "bg-accent/15 text-accent",
  lead: "bg-primary/10 text-primary",
  enquiry: "bg-primary/10 text-primary",
};

export default async function ContactHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await assertPermission("customers.view");
  } catch {
    redirect("/login?next=/admin/contacts");
  }

  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link
        href="/admin/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All contacts
      </Link>

      <h1 className="mt-4 font-serif text-4xl text-primary">
        {contact.name || "Unknown contact"}
      </h1>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {contact.phone ? <span>{contact.phone}</span> : null}
        {contact.email ? <span>{contact.email}</span> : null}
        <span>
          {contact.interactionCount}{" "}
          {contact.interactionCount === 1 ? "interaction" : "interactions"}
        </span>
      </div>

      <h2 className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-accent">
        History · latest first
      </h2>

      <div className="mt-4 space-y-2">
        {contact.interactions.map((it, idx) => {
          const hasBody = it.messages.length > 0 || Boolean(it.detail);
          return (
            <details
              key={idx}
              className="group overflow-hidden rounded-sm border border-border bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-accent/5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${TYPE_STYLE[it.type]}`}
                >
                  {TYPE_LABEL[it.type]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-primary">
                  {it.title}
                  {it.messageCount > 0 ? (
                    <span className="ml-2 text-xs text-muted">
                      {it.messageCount} msg
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {fmtDateTime(it.date)}
                </span>
                {hasBody ? (
                  <span
                    aria-hidden
                    className="shrink-0 text-muted transition group-open:rotate-180"
                  >
                    ▾
                  </span>
                ) : null}
              </summary>

              {it.messages.length ? (
                <div className="space-y-3 border-t border-border px-4 py-4">
                  {it.messages.map((m, i) => {
                    const isUser = m.role === "USER";
                    return (
                      <div
                        key={i}
                        className={isUser ? "flex justify-end" : "flex justify-start"}
                      >
                        <div
                          className={
                            isUser
                              ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                              : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-2 text-sm text-primary"
                          }
                        >
                          {m.content.split("\n").map((line, li) => (
                            <Fragment key={li}>
                              {li > 0 ? <br /> : null}
                              {line}
                            </Fragment>
                          ))}
                          <div
                            className={`mt-1 text-[10px] ${isUser ? "text-primary-foreground/70" : "text-muted"}`}
                          >
                            {fmtDateTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : it.detail ? (
                <div className="border-t border-border px-4 py-4 text-sm text-primary">
                  <p className="whitespace-pre-wrap">{it.detail}</p>
                </div>
              ) : null}
            </details>
          );
        })}
      </div>
    </div>
  );
}
