import { descriptionSections, highlightList } from "@/lib/property/description";

/**
 * Property/project description: AI summary and key features first, then the
 * About and Location sections; the rest (finishes, kitchen, furnishing) sits
 * under "Read full description". Works without the AI fields too.
 */
export function PropertyDescription({
  title,
  property,
}: {
  title: string;
  property: {
    description: string | null;
    descriptionSections?: unknown;
    summary?: string | null;
    highlights?: unknown;
  };
}) {
  const sections = descriptionSections(property);
  const highlights = highlightList(property.highlights);
  const summary = property.summary?.trim();
  if (!sections.length && !summary) return null;

  const shown = sections.filter((s) => s.key === "about" || s.key === "location");
  const rest = sections.filter((s) => s.key !== "about" && s.key !== "location");

  const Section = ({ s }: { s: (typeof sections)[number] }) => (
    <div className="mt-6">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">{s.heading}</h3>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-muted">
          {p}
        </p>
      ))}
    </div>
  );

  return (
    <section>
      <h2 className="font-serif text-2xl text-primary">{title}</h2>
      <div className="max-w-3xl">
        {summary ? (
          <p className="mt-3 text-base leading-relaxed text-primary">{summary}</p>
        ) : null}
        {highlights.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {highlights.map((h) => (
              <li key={h} className="flex gap-2 text-sm text-primary">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {shown.map((s) => (
          <Section key={s.key} s={s} />
        ))}
        {rest.length ? (
          <details className="group mt-6">
            <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
              <span className="group-open:hidden">Read full description</span>
              <span className="hidden group-open:inline">Show less</span>
            </summary>
            {rest.map((s) => (
              <Section key={s.key} s={s} />
            ))}
          </details>
        ) : null}
      </div>
    </section>
  );
}
