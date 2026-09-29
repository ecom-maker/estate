import Link from "next/link";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const metadata = {
  title: "Property Data Layer — API",
  description:
    "Canonical REST API over DMProperties inventory for websites and AI agents.",
};

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/properties",
    desc: "List properties. Filters: type, community, developer, minBedrooms, minPrice, maxPrice, offPlan, limit, offset.",
  },
  {
    method: "GET",
    path: "/api/v1/properties/{slug}",
    desc: "Full canonical property with its entire entity graph.",
  },
  { method: "GET", path: "/api/v1/projects", desc: "Off-plan projects." },
  {
    method: "GET",
    path: "/api/v1/communities",
    desc: "Communities with nearby landmarks (schools, metro stations).",
  },
  { method: "GET", path: "/api/v1/developers", desc: "Developers." },
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    desc: "OpenAPI 3.1 contract for the whole API.",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Developers · AI Agents
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">
        Property Data Layer
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        A canonical, source-agnostic API that sits between our database and every
        consumer — the website, the AI chat, and external AI agents. The
        inventory is the product: agents can read and reason over it directly.
      </p>

      <div className="mt-8 rounded-sm border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Entity graph
        </p>
        <p className="mt-2 font-mono text-sm text-primary">
          developer → project → property → unit → amenities → community
          (location) → nearby landmarks (schools, metro)
        </p>
      </div>

      <h2 className="mt-12 font-serif text-2xl text-primary">Endpoints</h2>
      <div className="mt-4 overflow-hidden rounded-sm border border-border">
        {ENDPOINTS.map((e, i) => (
          <div
            key={e.path}
            className={`flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <code className="shrink-0 text-sm text-accent">
              <span className="mr-2 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold">
                {e.method}
              </span>
              {e.path}
            </code>
            <span className="text-sm text-muted">{e.desc}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-serif text-2xl text-primary">Try it</h2>
      <pre className="mt-4 overflow-x-auto rounded-sm border border-border bg-primary/5 p-4 text-xs text-primary">
        {`curl ${SITE_URL}/api/v1/properties?type=villa&offPlan=false
curl ${SITE_URL}/api/v1/properties/{slug}
curl ${SITE_URL}/api/v1/communities`}
      </pre>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          href="/api/v1/openapi.json"
          className="font-medium text-accent hover:underline"
        >
          OpenAPI spec →
        </Link>
        <Link
          href="/api/v1"
          className="font-medium text-accent hover:underline"
        >
          API index →
        </Link>
        <Link href="/llms.txt" className="font-medium text-accent hover:underline">
          llms.txt →
        </Link>
      </div>
    </div>
  );
}
