import type { Metadata } from "next";
import { ContactLink, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DM Global collects, uses, shares and protects personal data on dmglobal.me, its AI assistant, WhatsApp and agent services.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          DM Global (&quot;we&quot;, &quot;us&quot;) runs dmglobal.me, a real-estate discovery
          service for properties and off-plan projects in the United Arab Emirates, including its
          AI assistant, WhatsApp assistant and the data services we offer to other AI agents. We
          decide how the personal data described here is used.
        </p>
        <p>
          For any privacy question or request, email <ContactLink />.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>We collect only what you give us or what is needed to run the service:</p>
        <ul>
          <li>
            <strong>Account details</strong>: name, email address, phone number and a securely
            hashed password, or the name, email and profile picture shared by Google if you sign
            in with Google.
          </li>
          <li>
            <strong>Enquiries and requests</strong>: what you enter in the &quot;Get in touch&quot;
            form, the &quot;Sell your property&quot; form, viewing or callback requests and property
            sourcing requests, such as your name, contact number, email, requirements, budget and
            message.
          </li>
          <li>
            <strong>Conversations with our AI assistant</strong> on the website and on WhatsApp,
            including the messages and voice notes you send, so we can answer you and follow up.
          </li>
          <li>
            <strong>Saved items</strong>: favourite properties and saved searches when you are
            signed in.
          </li>
          <li>
            <strong>AI agents acting for you</strong>: when another AI agent queries our agent
            service, we record the identifier, name and owner it reports, its software signature,
            what it asked for and when. If it sends a sourcing request for you, we receive the
            contact details and requirements it passes on.
          </li>
          <li>
            <strong>Technical data</strong>: IP address, browser type and request logs kept by
            our hosting provider for security, rate limiting and troubleshooting.
          </li>
        </ul>
        <p>
          We do not use third-party advertising or analytics trackers, and we do not ask for
          sensitive personal data. Please do not send us payment card details, passport or
          Emirates ID copies through the chat or forms.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <ul>
        <li>To show you properties and projects and answer your questions.</li>
        <li>
          To respond to your enquiries, arrange viewings and callbacks, and source properties
          that are not listed on the site.
        </li>
        <li>To create and secure your account, including sign-in codes sent to your phone.</li>
        <li>To remember your favourites, saved searches and chat history.</li>
        <li>To prevent spam and abuse, and to keep the service running and secure.</li>
        <li>To improve our listings, search and assistant.</li>
        <li>To meet our legal and regulatory obligations.</li>
      </ul>
    ),
  },
  {
    id: "legal-basis",
    title: "Why we are allowed to use it",
    body: (
      <p>
        We process personal data because you asked us to (for example, to answer an enquiry or
        provide your account), because of our legitimate interest in running a safe and useful
        property service, with your consent where it is required, or to meet legal obligations.
        This follows the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)
        and, where it applies to you, the EU/UK GDPR.
      </p>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          Our assistant uses large language models from third-party providers (such as OpenAI or
          Google Gemini) to understand your messages and write replies. The text of your
          messages, and voice notes converted to text, is sent to the provider to generate each
          answer. We tell our assistant to rely only on our own listing and market data.
        </p>
        <p>
          AI answers can be wrong. They are not financial, legal or investment advice; please
          confirm important details with our team before making a decision.
        </p>
        <p>
          If you add your own AI provider key in your account settings, your requests are sent
          to that provider under your own agreement with them. We store the key encrypted.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We do not sell your personal data. We share it only with:</p>
        <ul>
          <li>
            <strong>Service providers</strong> who run parts of the service for us: website
            hosting (Vercel), database and file storage (Supabase), AI model providers, email
            delivery (Resend), SMS sign-in codes, WhatsApp messaging (Meta) and maps (Google).
            They may only use the data to provide their service to us.
          </li>
          <li>
            <strong>Developers, owners and partner brokers</strong> where you ask us to arrange a
            viewing, a callback or a property search, and only what they need for that request.
          </li>
          <li>
            <strong>Authorities</strong> when the law requires it, or to protect our rights or
            someone&apos;s safety.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Some of our providers store or process data outside the UAE, for example in the European
        Union or the United States. Where that happens we rely on the safeguards those providers
        offer, such as standard contractual clauses, so your data stays protected.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep account data while your account is open. We keep enquiries, leads and
        conversations for as long as needed to deal with them and follow up, and generally no
        longer than three years after our last contact with you, unless the law requires longer.
        Security logs are kept for a short period. When data is no longer needed we delete or
        anonymise it.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you can ask us to:</p>
        <ul>
          <li>give you a copy of the personal data we hold about you;</li>
          <li>correct data that is wrong or incomplete;</li>
          <li>delete your data or close your account;</li>
          <li>stop or limit how we use it, or object to a use;</li>
          <li>send your data to you or another provider in a usable format;</li>
          <li>withdraw consent you gave earlier.</li>
        </ul>
        <p>
          Email <ContactLink /> and we will reply within 30 days. You can also complain to the
          UAE Data Office or to the data protection authority where you live.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use only the cookies needed to keep you signed in and to protect sign-in forms. Your
        browser&apos;s local storage keeps your recent chat list and similar preferences on your
        own device; clearing your browser data removes them. We do not use advertising cookies.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is sent over encrypted connections (HTTPS). Passwords are hashed, stored keys are
        encrypted, and access to admin tools is limited to authorised staff. No system is
        perfectly secure; if we learn of a breach that affects you, we will tell you and the
        relevant authority as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The service is meant for adults. We do not knowingly collect data from anyone under 18.
        If you believe a child has given us personal data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the service changes. We will change the &quot;last
        updated&quot; date above, and tell you directly if the changes are significant.
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

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data DM Global collects when you use dmglobal.me,
          our AI assistant, our WhatsApp assistant or our services for AI agents, how we use it,
          and the choices you have.
        </p>
      }
      sections={sections}
      other={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
