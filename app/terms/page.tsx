import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using dmglobal.me, the DM Global AI assistant, WhatsApp assistant and data services for AI agents.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "About these terms",
    body: (
      <p>
        These terms apply to dmglobal.me, our AI assistant, our WhatsApp assistant and our data
        services for AI agents (together, the &quot;Service&quot;), run by DM Global
        (&quot;we&quot;, &quot;us&quot;). By using the Service you agree to them. If you do not
        agree, please do not use the Service.
      </p>
    ),
  },
  {
    id: "service",
    title: "What the Service is",
    body: (
      <>
        <p>
          DM Global helps you discover properties and off-plan projects in the United Arab
          Emirates, ask questions about them, and get in touch with our team. Listings, prices,
          payment plans, availability, floor plans and images come from developers, owners and
          other sources.
        </p>
        <p>
          A listing is an invitation to enquire, not an offer to sell or lease. Nothing on the
          Service is a binding agreement until it is set out in a written contract signed by the
          parties.
        </p>
      </>
    ),
  },
  {
    id: "accuracy",
    title: "Listings and information",
    body: (
      <>
        <p>
          We work to keep information current and correct, but listings can change or sell at any
          time, and details from third parties may contain errors. Prices are in UAE dirhams
          (AED) unless stated otherwise and may exclude fees such as Dubai Land Department
          transfer fees, agency commission and service charges.
        </p>
        <p>
          Images, renders and floor plans may be illustrative. Market data such as past
          transaction prices and trends is shown for information only and does not predict
          future prices or returns. Always check details yourself, and with the developer or
          owner, before deciding.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI assistant",
    body: (
      <>
        <p>
          Our AI assistant answers questions using our listing and market data, but AI can make
          mistakes. Its answers are general information, not financial, legal, tax, mortgage or
          investment advice, and they do not create any commitment from us.
        </p>
        <p>
          Viewings, callbacks and similar requests made through the assistant are confirmed only
          when a member of our team contacts you.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>Give accurate details and keep them up to date.</li>
        <li>
          Keep your password and sign-in codes private. You are responsible for activity on your
          account; tell us at once if you think someone else has used it.
        </li>
        <li>We may suspend or close accounts that break these terms.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>When using the Service, you agree not to:</p>
        <ul>
          <li>break any law, or use the Service for fraud or money laundering;</li>
          <li>submit false enquiries, or other people&apos;s details without their permission;</li>
          <li>send spam, malware or abusive content, including to our assistants;</li>
          <li>
            try to break, overload or get around the Service&apos;s security, rate limits or
            access controls;
          </li>
          <li>
            copy or resell our listings or data in bulk, except through our published API and
            agent services within their limits and these terms.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "agents",
    title: "AI agents and the API",
    body: (
      <>
        <p>
          AI agents and developers may use our public data API and agent endpoint described in
          our <Link href="/api-docs" className="text-accent hover:underline">API documentation</Link>{" "}
          and Agent Card. If you do, identify your agent honestly, stay within the rate limits,
          and link back to the listing on dmglobal.me when you show our data to people.
        </p>
        <p>
          If your agent sends a sourcing or contact request for a person, you confirm that the
          person has asked for it and agreed to their details being shared with us. We may limit
          or block agents that misuse the Service.
        </p>
      </>
    ),
  },
  {
    id: "sourcing",
    title: "Property sourcing",
    body: (
      <p>
        If you ask us to find a property that is not listed, we will make reasonable efforts to
        find suitable options on the market, but we cannot promise that a matching property is
        available or will be found. Any fees for brokerage services are agreed separately in
        writing.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Content and intellectual property",
    body: (
      <p>
        The Service&apos;s design, text, software and brand belong to DM Global or its licensors.
        Listing content and images belong to their owners. You may view and share links to the
        Service for personal use. Anything you send us, such as enquiry details or property
        descriptions, you allow us to use to provide the Service.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    body: (
      <p>
        The Service links to or uses third-party services such as WhatsApp, Google Maps and
        Google sign-in. Their own terms and privacy policies apply, and we are not responsible
        for them.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Our liability",
    body: (
      <>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the extent
          the law allows, we are not liable for indirect or consequential loss, lost profits, or
          decisions you make based on information on the Service, including information from AI
          answers or third parties.
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited under UAE law, such as
          for fraud.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    body: (
      <p>
        How we handle personal data is explained in our{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        We may change the Service or these terms. The &quot;last updated&quot; date above shows
        the current version; if you keep using the Service after a change, the new terms apply.
        We will give notice of significant changes.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the Emirate of Dubai and the federal laws of the
        United Arab Emirates. The courts of Dubai have jurisdiction over any dispute.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        DM Global, Dubai, United Arab Emirates. Email <ContactLink />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro={
        <p>
          Please read these terms before using DM Global. They explain what you can expect from
          us and what we expect from you.
        </p>
      }
      sections={sections}
      other={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
