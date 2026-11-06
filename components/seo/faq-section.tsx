import { ChevronDown } from "lucide-react";
import type { Faq } from "@/lib/seo/faq";

/**
 * Server-rendered, visible FAQ section + matching FAQPage JSON-LD.
 *
 * The visible <summary>/<p> text and the JSON-LD Question/Answer text are the
 * exact same strings (f.q / f.a), so structured data never diverges from what
 * users and crawlers see. Renders nothing when there are no FAQs.
 */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

export function FaqSection({
  faqs,
  lastUpdated,
  heading = "Frequently asked questions",
}: {
  faqs: Faq[];
  lastUpdated?: Date | null;
  heading?: string;
}) {
  if (!faqs.length) return null;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="mt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl text-primary">{heading}</h2>
        {lastUpdated ? (
          <p className="text-xs text-muted">Last updated {fmtDate(lastUpdated)}</p>
        ) : null}
      </div>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-primary">
              <span>{f.q}</span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
