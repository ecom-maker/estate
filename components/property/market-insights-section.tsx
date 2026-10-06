import Link from "next/link";
import Image from "next/image";
import { getMarketInsights } from "@/lib/property/market-data";
import { PriceTrendChart } from "@/components/property/price-trend-chart";
import { TransactionsBlock } from "@/components/property/transactions-block";
import { cn } from "@/lib/utils";

type PropertyInput = {
  id: string;
  title: string;
  type: string;
  bedrooms: number | null;
  priceAed: number | null;
  areaSqft: number | null;
  offPlan: boolean;
  images?: { url: string; alt?: string | null }[] | null;
  community?: { name: string; slug: string } | null;
  developer?: { name: string } | null;
  paymentPlan?: unknown;
  metadata?: unknown;
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function deliveryLabel(offPlan: boolean, handoverDate?: string): string {
  if (!offPlan) return "Ready";
  if (!handoverDate) return "TBA";
  const d = new Date(handoverDate);
  if (Number.isNaN(d.getTime())) return handoverDate;
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

export async function MarketInsightsSection({
  property,
}: {
  property: PropertyInput;
}) {
  // Real DLD transactions for comparable units, or null when there are too few
  // to say anything. Nothing here is estimated — if the data is thin, the
  // transactions table and the trend chart are simply not rendered.
  const insights = await getMarketInsights(property);
  const image = property.images?.[0];
  const pp = (property.paymentPlan ?? {}) as { downPaymentPct?: number };
  const meta = (property.metadata ?? {}) as { handoverDate?: string };
  const communityName = property.community?.name ?? "Dubai";
  const communityHref = property.community
    ? `/search?q=${encodeURIComponent(property.community.slug)}`
    : "/properties";

  return (
    <div className="mt-16 space-y-14">
      {/* Project Information */}
      <section>
        <h2 className="font-serif text-2xl text-primary">Project Information</h2>
        <div className="mt-5 overflow-hidden rounded-sm border border-border bg-card">
          <div className="grid gap-6 p-5 md:grid-cols-[240px_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-primary/10">
              {image?.url ? (
                <Image
                  src={image.url}
                  alt={image.alt ?? property.title}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={cn(
                      "inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                      property.offPlan
                        ? "bg-accent/15 text-accent"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {property.offPlan ? "Off-plan" : "Completed"}
                  </span>
                  <h3 className="mt-2 font-serif text-xl text-primary">
                    {property.title}
                    {property.developer ? ` by ${property.developer.name}` : ""}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {property.bedrooms ?? "—"} bedrooms
                  </p>
                </div>
                {property.developer ? (
                  <span className="shrink-0 font-serif text-lg uppercase tracking-wide text-primary">
                    {property.developer.name}
                  </span>
                ) : null}
              </div>

              <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted">Developed by</dt>
                  <dd className="font-medium text-primary">
                    {property.developer?.name ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted">Delivery date</dt>
                  <dd className="font-medium text-primary">
                    {deliveryLabel(property.offPlan, meta.handoverDate)}
                  </dd>
                </div>
                {property.offPlan ? (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted">Down payment</dt>
                    <dd className="font-medium text-primary">
                      {pp.downPaymentPct ?? 20}%
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted">Property type</dt>
                  <dd className="font-medium text-primary">
                    {titleCase(property.type)}
                  </dd>
                </div>
              </dl>

              <Link
                href={communityHref}
                className="mt-5 inline-flex items-center rounded-sm border border-border px-4 py-2 text-sm font-medium text-primary transition hover:border-accent"
              >
                View all project details
              </Link>
            </div>
          </div>
        </div>
      </section>

      {insights ? (
        <>
          {/* Transactions for similar properties */}
          <TransactionsBlock
            sold={insights.sold}
            rented={insights.rented}
            buildingName={communityName}
            subtitle={`${property.bedrooms ?? "—"} Bed ${titleCase(property.type)}s in ${communityName}`}
          />

          {/* Prices & trends */}
          <section>
            <h2 className="font-serif text-2xl text-primary">
              Prices &amp; trends
            </h2>
            <p className="mt-1 text-sm text-muted">
              {insights.trend.primaryLabel} vs {insights.trend.secondaryLabel}
            </p>
            <div className="mt-5 rounded-sm border border-border bg-card p-5">
              <PriceTrendChart
                months={insights.trend.months}
                sale={insights.trend.sale}
                rent={insights.trend.rent}
                primaryLabel={insights.trend.primaryLabel}
                secondaryLabel={insights.trend.secondaryLabel}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Based on recorded Dubai Land Department transactions for
              comparable units in {communityName}.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
