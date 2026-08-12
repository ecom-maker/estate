import Link from "next/link";
import { AIChat } from "@/components/ai/ai-chat";

export const metadata = {
  title: "Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-7xl gap-8 px-6 py-28 md:grid-cols-[minmax(300px,0.95fr)_1.05fr] md:px-10">
      <aside className="rounded-sm border border-border bg-card p-6">
        <AIChat
          placeholder="Ask a follow-up..."
          initialMessages={
            query
              ? [
                  { role: "user", content: query },
                  {
                    role: "assistant",
                    content:
                      "Open the composer below to run this query through conversational search, or type a follow-up refinement.",
                  },
                ]
              : []
          }
        />
      </aside>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-primary">Results</h1>
            <p className="mt-1 text-sm text-muted">
              Dual-view search · filters · map-ready
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-medium text-accent hover:underline"
          >
            Browse all
          </Link>
        </div>
        <SearchResultsHint query={query} />
      </section>
    </div>
  );
}

function SearchResultsHint({ query }: { query: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
      {query ? (
        <p>
          Query received: <span className="text-primary">“{query}”</span>. Use
          the assistant to extract intent and rank inventory. Property cards
          appear from seeded data via the chat pipeline and{" "}
          <Link href="/properties" className="text-accent hover:underline">
            /properties
          </Link>
          .
        </p>
      ) : (
        <p>Start from the homepage chat bar or ask a question on the left.</p>
      )}
    </div>
  );
}
