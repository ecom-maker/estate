import Link from "next/link";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const metadata = {
  title: "Partner Listing API",
  description:
    "How partner companies submit property listings to the DM Global portal.",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-sm border border-border bg-card p-4 text-xs leading-relaxed text-primary">
      <code>{children}</code>
    </pre>
  );
}

function Field({
  name,
  type,
  req,
  desc,
}: {
  name: string;
  type: string;
  req?: boolean;
  desc: string;
}) {
  return (
    <tr className="border-t border-border/60 align-top">
      <td className="py-2 pr-4 font-mono text-xs text-primary">{name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-muted">{type}</td>
      <td className="py-2 pr-4 text-xs">
        {req ? (
          <span className="text-red-600">required</span>
        ) : (
          <span className="text-muted">optional</span>
        )}
      </td>
      <td className="py-2 text-xs text-muted">{desc}</td>
    </tr>
  );
}

export default function PartnerApiDocsPage() {
  const base = `${SITE_URL}/api/v1`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link href="/api-docs" className="text-xs text-muted hover:text-primary">
        ← API overview
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        For partner companies
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">
        Partner Listing API
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Submit your property listings to the DM Global portal programmatically.
        You send us listings; we review and publish them. Each listing is keyed
        by your own <code>externalId</code>, so re-sending the same id updates
        the existing listing instead of creating a duplicate.
      </p>

      <h2 className="mt-10 font-serif text-2xl text-primary">Authentication</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        DM Global issues you a secret API key. Send it on every request in the{" "}
        <code>Authorization</code> header (or <code>X-API-Key</code>). Keep it
        server-side; never expose it in a browser. To get a key, contact DM
        Global.
      </p>
      <Code>{`Authorization: Bearer dmg_partner_XXXXXXXXXXXX`}</Code>

      <h2 className="mt-10 font-serif text-2xl text-primary">Endpoints</h2>
      <table className="mt-3 w-full text-left">
        <tbody className="text-sm">
          <tr className="border-t border-border/60">
            <td className="py-2 pr-4 font-mono text-xs font-semibold text-green-700">POST</td>
            <td className="py-2 font-mono text-xs text-primary">/api/v1/listings</td>
            <td className="py-2 text-xs text-muted">Create or update listings.</td>
          </tr>
          <tr className="border-t border-border/60">
            <td className="py-2 pr-4 font-mono text-xs font-semibold text-blue-700">GET</td>
            <td className="py-2 font-mono text-xs text-primary">/api/v1/listings</td>
            <td className="py-2 text-xs text-muted">List your submitted listings + status.</td>
          </tr>
          <tr className="border-t border-border/60">
            <td className="py-2 pr-4 font-mono text-xs font-semibold text-blue-700">GET</td>
            <td className="py-2 font-mono text-xs text-primary">/api/v1/listings/&#123;externalId&#125;</td>
            <td className="py-2 text-xs text-muted">Fetch one of your listings.</td>
          </tr>
          <tr className="border-t border-border/60">
            <td className="py-2 pr-4 font-mono text-xs font-semibold text-red-700">DELETE</td>
            <td className="py-2 font-mono text-xs text-primary">/api/v1/listings/&#123;externalId&#125;</td>
            <td className="py-2 text-xs text-muted">Withdraw a listing.</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-10 font-serif text-2xl text-primary">Listing fields</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="py-2 pr-4">Field</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4" />
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            <Field name="externalId" type="string" req desc="Your unique id for this listing. Used to update/withdraw it later." />
            <Field name="title" type="string" req desc="Listing headline." />
            <Field name="type" type="string" req desc="villa | apartment | penthouse | townhouse | unit | land" />
            <Field name="dealType" type="string" desc="sale (default) or rent." />
            <Field name="country" type="string" desc="ISO-3166 alpha-2 country code, e.g. 'AE', 'GB', 'SA'. Defaults to AE." />
            <Field name="price" type="{ amount }" desc="Native price, e.g. { currency: 'GBP', amount: 450000 }. Or send priceAed." />
            <Field name="currency" type="string" desc="ISO currency code, e.g. 'AED', 'GBP', 'USD'. Defaults to AED (or price.currency)." />
            <Field name="priceAed" type="number" desc="Price in AED (shortcut when the listing is in AED)." />
            <Field name="bedrooms" type="number" desc="Bedroom count (0 = studio)." />
            <Field name="bathrooms" type="number" desc="Bathroom count." />
            <Field name="areaSqft" type="number" desc="Built-up area in sqft." />
            <Field name="community" type="string" desc="Community / area name, e.g. 'Dubai Marina'. Matched to our catalog." />
            <Field name="developer" type="string" desc="Developer name, e.g. 'Emaar'. Matched to our records." />
            <Field name="offPlan" type="boolean" desc="true for off-plan; false for ready/completed." />
            <Field name="handoverDate" type="string" desc="Handover date, e.g. '2027-06-30'." />
            <Field name="furnished" type="boolean" desc="Furnished?" />
            <Field name="waterfront" type="boolean" desc="Waterfront?" />
            <Field name="description" type="string" desc="Full description." />
            <Field name="images" type="string[]" desc="Public image URLs (first becomes the cover). Max 40." />
            <Field name="amenities" type="string[]" desc="Amenity names, e.g. ['Gym','Pool']." />
            <Field name="latitude" type="number" desc="Decimal latitude." />
            <Field name="longitude" type="number" desc="Decimal longitude." />
            <Field name="contact" type="object" desc="Your listing contact details (kept internal)." />
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-serif text-2xl text-primary">Example — submit</h2>
      <Code>{`curl -X POST ${base}/listings \\
  -H "Authorization: Bearer dmg_partner_XXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "listings": [
      {
        "externalId": "SKY-1042",
        "title": "2BR with full marina view",
        "type": "apartment",
        "dealType": "sale",
        "price": { "currency": "AED", "amount": 2650000 },
        "bedrooms": 2,
        "bathrooms": 2,
        "areaSqft": 1180,
        "community": "Dubai Marina",
        "developer": "Emaar",
        "offPlan": false,
        "description": "High-floor 2-bed with panoramic views...",
        "images": ["https://cdn.example.com/sky1042/1.jpg"],
        "amenities": ["Gym", "Pool", "Covered Parking"]
      }
    ]
  }'`}</Code>

      <h3 className="mt-6 font-serif text-lg text-primary">Response</h3>
      <Code>{`{
  "partner": "Skyline Realty LLC",
  "summary": { "received": 1, "created": 1, "updated": 0, "failed": 0 },
  "note": "Submissions are saved as DRAFT and go live after DM Global review.",
  "results": [
    {
      "externalId": "SKY-1042",
      "action": "created",
      "status": "DRAFT",
      "url": "${SITE_URL}/properties/2br-with-full-marina-view"
    }
  ]
}`}</Code>

      <h2 className="mt-10 font-serif text-2xl text-primary">
        Countries &amp; currency
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Listings can be from any country. Send <code>country</code> (ISO-2) and
        the native <code>currency</code> with the price. We display the price in
        its own currency and also store an AED-normalized value so cross-country
        sorting and price filters work. Omit them and the listing defaults to
        AE / AED.
      </p>

      <h2 className="mt-10 font-serif text-2xl text-primary">Review &amp; status</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Every submission lands as <strong>DRAFT</strong> and is published by DM
        Global after review. Check status anytime with{" "}
        <code>GET /api/v1/listings</code>. Status values:{" "}
        <code>DRAFT</code> (pending), <code>ACTIVE</code> (live),{" "}
        <code>OFF_MARKET</code> (withdrawn). Re-submitting an existing
        <code> externalId</code> updates the listing and keeps its current
        status (an approved listing won’t revert to draft).
      </p>

      <h2 className="mt-10 font-serif text-2xl text-primary">Errors</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Errors return JSON as <code>{`{ "error": { "status", "message" } }`}</code>.
        Per-listing validation errors appear in the <code>results</code> array
        (that listing is skipped; valid ones still process). Common statuses:{" "}
        <code>401</code> bad key, <code>400</code> malformed body,{" "}
        <code>422</code> every listing failed validation.
      </p>

      <p className="mt-10 text-sm text-muted">
        Need a key or have questions? Contact DM Global.
      </p>
    </div>
  );
}
