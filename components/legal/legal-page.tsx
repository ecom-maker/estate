import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_LAST_UPDATED = "8 October 2026";

// Where privacy and terms questions go. Override with LEGAL_CONTACT_EMAIL.
export const LEGAL_CONTACT_EMAIL =
  process.env.LEGAL_CONTACT_EMAIL || "dmproperties2312@gmail.com";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for the Privacy Policy and Terms of Service pages. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  other,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-24 pt-14 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl text-primary md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-6 max-w-3xl text-base leading-relaxed text-muted">{intro}</div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="h-fit lg:sticky lg:top-24">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">On this page</p>
          <ol className="mt-3 space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary transition hover:text-accent">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="font-serif text-2xl text-primary">
                {i + 1}. {s.title}
              </h2>
              <div className="legal-prose mt-3 space-y-3 text-sm leading-relaxed text-muted">
                {s.body}
              </div>
            </section>
          ))}

          <p className="border-t border-border pt-6 text-sm text-muted">
            See also our{" "}
            <Link href={other.href} className="text-accent hover:underline">
              {other.label}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-accent hover:underline">
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
