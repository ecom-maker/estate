import { TrendingUp, Wallet, PiggyBank, LineChart, Info } from "lucide-react";
import { PROJECTION_YEARS, type Investment } from "@/lib/property/investment";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;
const pct = (fraction: number, dp = 1) => `${(fraction * 100).toFixed(dp)}%`;

/** An (i) that reveals an explanation on hover or keyboard focus (no JS). */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label="How this is calculated"
        className="rounded-full text-muted/70 transition hover:text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-md border border-border bg-card p-3 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function Tile({
  label,
  icon,
  value,
  sub,
  gold,
  info,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  sub?: string;
  gold?: boolean;
  info?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
        <span className="flex items-center gap-1.5 text-muted">
          {info}
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 font-serif text-2xl ${gold ? "text-accent" : "text-primary"}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function InvestmentPanel({ data }: { data: Investment }) {
  const { net } = data;
  const appr = data.appreciation;
  const appreciationNote =
    appr.source === "observed"
      ? `@ ~${pct(appr.rate, 1)} / yr (recorded trend)`
      : `@ ${pct(appr.rate, 0)} annual projection`;
  const growthNote =
    appr.source === "observed"
      ? `the recorded ~${pct(appr.rate, 1)} p.a. price trend${
          appr.basisLabel ? ` for ${appr.basisLabel}` : ""
        }`
      : `a ${pct(appr.rate, 0)} p.a. price-growth assumption`;
  const capitalGainTip =
    appr.source === "observed"
      ? `Price today grown over ${PROJECTION_YEARS} years at ~${pct(
          appr.rate,
          1,
        )}/yr. That rate comes from recorded DLD sale prices${
          appr.basisLabel ? ` for ${appr.basisLabel}` : ""
        }, blended halfway toward a long-run 7%/yr and capped at 15%/yr. An estimate, not a guarantee.`
      : `Price today grown over ${PROJECTION_YEARS} years at ${pct(
          appr.rate,
          0,
        )}/yr — a long-run assumption used because there isn't enough recorded sales history here to measure a local trend. An estimate, not a guarantee.`;
  const km = data.rentDistanceKm;
  const nearbyWhere =
    typeof km === "number" && km >= 0.1
      ? `the nearest building with rent data (~${km.toFixed(1)} km away)`
      : "a nearby building";
  const rentNote =
    data.rentScope === "building"
      ? "Rent estimated from recorded DLD rents in this building"
      : `Rent estimated from recorded DLD rents at ${nearbyWhere}`;

  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl text-primary">Investment snapshot</h2>
      <p className="mt-1 text-sm text-muted">
        Projected return on this unit at today&rsquo;s price.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {net ? (
          <>
            <Tile
              label="Net rental yield"
              icon={<TrendingUp className="h-4 w-4" aria-hidden />}
              value={pct(net.netYield, 2)}
              sub={`Gross: ${pct(data.grossYield, 1)}`}
              gold
            />
            <Tile
              label="Monthly cashflow"
              icon={<Wallet className="h-4 w-4" aria-hidden />}
              value={aed(net.monthlyCashflow)}
              sub="Net in pocket / mo"
            />
            <Tile
              label={`${PROJECTION_YEARS}-year capital gain`}
              icon={<LineChart className="h-4 w-4" aria-hidden />}
              value={aed(data.capitalGain)}
              sub={appreciationNote}
              info={<InfoTip text={capitalGainTip} />}
            />
            <Tile
              label={`${PROJECTION_YEARS}-year total return`}
              icon={<PiggyBank className="h-4 w-4" aria-hidden />}
              value={aed(net.totalReturn)}
              sub={`+${pct(net.totalReturnRate, 1)} on capital`}
              gold
            />
          </>
        ) : (
          <>
            <Tile
              label="Gross rental yield"
              icon={<TrendingUp className="h-4 w-4" aria-hidden />}
              value={pct(data.grossYield, 2)}
              sub="Before service charges"
              gold
            />
            <Tile
              label="Gross annual rent"
              icon={<Wallet className="h-4 w-4" aria-hidden />}
              value={aed(data.grossAnnualRent)}
              sub={`${aed(data.rentPerSqftYr)} / sqft / yr`}
            />
            <Tile
              label={`${PROJECTION_YEARS}-year capital gain`}
              icon={<LineChart className="h-4 w-4" aria-hidden />}
              value={aed(data.capitalGain)}
              sub={appreciationNote}
              info={<InfoTip text={capitalGainTip} />}
            />
          </>
        )}
      </div>

      {net ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Annual cashflow breakdown
          </p>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Gross annual rent</dt>
              <dd className="font-medium text-primary">
                {aed(data.grossAnnualRent)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">
                Service charges (AED {net.serviceChargePerSqft}/sqft)
              </dt>
              <dd className="text-red-600">− {aed(net.serviceCharges)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">
                Property management ({pct(net.managementRate, 0)})
              </dt>
              <dd className="text-red-600">− {aed(net.management)}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
              <dt className="font-semibold text-primary">Net annual cash flow</dt>
              <dd className="font-semibold text-accent">{aed(net.netAnnual)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {rentNote}. Illustrative estimate using {growthNote} over{" "}
        {PROJECTION_YEARS} years — not a guarantee or financial advice.
      </p>
    </section>
  );
}
