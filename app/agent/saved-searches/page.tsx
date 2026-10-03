import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { formatAED } from "@/lib/utils";
import { AgentShell, EmptyState } from "@/components/agent/agent-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved Searches" };

type Intent = {
  propertyType?: string;
  propertyTypes?: string[];
  dealType?: string;
  community?: string;
  location?: string;
  bedrooms?: number;
  bedroomsList?: number[];
  minPriceAED?: number;
  maxPriceAED?: number;
  waterfront?: boolean;
  offPlan?: boolean;
};

function summarize(intent: Intent): string[] {
  const chips: string[] = [];
  const type = intent.propertyTypes?.length
    ? intent.propertyTypes.join("/")
    : intent.propertyType;
  if (type) chips.push(type);
  if (intent.community || intent.location)
    chips.push(intent.community ?? intent.location!);
  const beds = intent.bedroomsList?.length
    ? intent.bedroomsList.join(", ")
    : intent.bedrooms != null
      ? String(intent.bedrooms)
      : null;
  if (beds) chips.push(`${beds} bed`);
  if (intent.minPriceAED != null || intent.maxPriceAED != null) {
    chips.push(
      `${intent.minPriceAED ? formatAED(intent.minPriceAED) : "any"} – ${intent.maxPriceAED ? formatAED(intent.maxPriceAED) : "any"}`,
    );
  }
  if (intent.dealType) chips.push(intent.dealType === "rent" ? "Rent" : "Buy");
  if (intent.offPlan) chips.push("Off-plan");
  if (intent.waterfront) chips.push("Waterfront");
  return chips;
}

/** Build a /search query string from a saved intent so it can be re-run. */
function toQuery(name: string, intent: Intent): string {
  const parts = summarize(intent).join(" ");
  return parts || name;
}

export default async function SavedSearchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?error=AccessDenied");

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AgentShell
      title="Saved Searches"
      subtitle={`${searches.length} saved ${searches.length === 1 ? "search" : "searches"}.`}
    >
      {searches.length === 0 ? (
        <EmptyState>
          No saved searches yet. Save a search from the assistant to reuse its
          filters later.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => {
            const chips = summarize(s.intent as Intent);
            return (
              <li
                key={s.id}
                className="rounded-sm border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-lg text-primary">{s.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {chips.length ? (
                        chips.map((c, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted">Any criteria</span>
                      )}
                    </div>
                    {s.notify ? (
                      <p className="mt-2 text-xs text-accent">
                        Alerts on for new matches
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/search?q=${encodeURIComponent(toQuery(s.name, s.intent as Intent))}`}
                    className="shrink-0 rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-primary hover:border-accent"
                  >
                    Run search
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AgentShell>
  );
}
