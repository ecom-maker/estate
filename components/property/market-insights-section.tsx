import Link from "next/link";
import Image from "next/image";
import { buildMarketInsights, type Txn } from "@/lib/property/market-insights";
import { PriceTrendChart } from "@/components/property/price-trend-chart";
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

function TxnTable({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: Txn[];
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-primary">{title}</p>
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary/[0.03] text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 text-right font-medium">{unit}</th>
              <th className="px-4 py-2.5 text-right font-medium">Area (sqft)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted">{r.date}</td>
                <td className="px-4 py-2.5 text-right text-primary">
                  {r.aed.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-muted">
                  {r.area.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MarketInsightsSection({ property }: { property: PropertyInput }) {
  const insights = buildMarketInsights(property);
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
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted">Down payment</dt>
                  <dd className="font-medium text-primary">
                    {pp.downPaymentPct ?? 20}%
                  </dd>
                </div>
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

      {/* Transactions for Similar Properties */}
      <section>
        <h2 className="font-serif text-2xl text-primary">
          Transactions for Similar Properties
        </h2>
        <p className="mt-1 text-sm text-muted">
          {property.bedrooms ?? "—"} Beds {titleCase(property.type)} in{" "}
          {communityName}
        </p>
        <div className="mt-5 grid gap-8 md:grid-cols-2">
          <TxnTable title="Sold for" unit="AED" rows={insights.sold} />
          <TxnTable title="Rented for" unit="AED/year" rows={insights.rented} />
        </div>
        <div className="mt-6 text-center">
          <Link
            href={communityHref}
            className="inline-flex items-center rounded-sm border border-border px-4 py-2 text-sm font-medium text-primary transition hover:border-accent"
          >
            See all transactions in this location
          </Link>
          <p className="mt-3 text-[11px] text-muted">Powered by DataGuru</p>
        </div>
      </section>

      {/* Prices & trends */}
      <section>
        <h2 className="font-serif text-2xl text-primary">Prices &amp; trends</h2>
        <p className="mt-1 text-sm text-muted">
          {property.bedrooms ?? "—"} bedroom {titleCase(property.type).toLowerCase()}s
          sold in {communityName}
        </p>
        <div className="mt-5 rounded-sm border border-border bg-card p-5">
          <PriceTrendChart
            months={insights.trend.months}
            primary={insights.trend.primary}
            secondary={insights.trend.secondary}
            primaryLabel={insights.trend.primaryLabel}
            secondaryLabel={insights.trend.secondaryLabel}
          />
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">
          Powered by DataGuru
        </p>
      </section>
    </div>
  );
}
