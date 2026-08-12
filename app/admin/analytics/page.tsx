import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  let stats = {
    properties: 0,
    conversations: 0,
    searches: 0,
    favorites: 0,
    aiRequests: 0,
    tokens: 0,
  };

  try {
    const [properties, conversations, searches, favorites, aiRequests, tokenAgg] =
      await Promise.all([
        prisma.property.count({ where: { deletedAt: null } }),
        prisma.chatSession.count(),
        prisma.searchHistory.count(),
        prisma.favorite.count(),
        prisma.aiLog.count(),
        prisma.aiLog.aggregate({ _sum: { totalTokens: true } }),
      ]);
    stats = {
      properties,
      conversations,
      searches,
      favorites,
      aiRequests,
      tokens: tokenAgg._sum.totalTokens ?? 0,
    };
  } catch {
    // DB unavailable
  }

  const cards = [
    ["Properties", stats.properties],
    ["AI conversations", stats.conversations],
    ["Searches", stats.searches],
    ["Favorites", stats.favorites],
    ["AI requests", stats.aiRequests],
    ["Tokens used", stats.tokens],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Analytics
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Analytics</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-sm border border-border bg-card p-5"
          >
            <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-3 font-serif text-3xl text-primary">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
