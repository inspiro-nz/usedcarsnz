import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How UsedCarsNZ handles enquiry and email-lead data (draft).",
};

/**
 * Privacy page — PLACEHOLDER copy (Strategy §14 item 6). This is plain-English
 * scaffolding so the demo has an honest privacy surface to point at; it is NOT
 * settled legal text and must be reviewed and rewritten by a lawyer before any
 * public launch. Every section is deliberately generic and conservative.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">DRAFT — placeholder copy, pending lawyer review.</p>
        <p className="mt-1">
          This page is scaffolding for the pilot, written in plain English to
          describe what the system actually does with data. It is <strong>not
          legal advice and not final</strong>. A lawyer must review and rewrite it
          before public launch.
        </p>
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
        Privacy at UsedCarsNZ
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated: draft — not yet published.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <Section title="What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>When you enquire on a car:</strong> your name, email,
              optional phone number, your message, and which listing you enquired
              on.
            </li>
            <li>
              <strong>Email-lane leads:</strong> if a dealer forwards a buyer
              enquiry that originated on another marketplace (e.g. Trade Me) to
              their UsedCarsNZ lead address, we receive the buyer&apos;s email
              address and message so we can respond and pass it to the dealer.
            </li>
            <li>
              <strong>Technical data:</strong> your IP address and similar request
              metadata, used only for rate-limiting and bot protection
              (Cloudflare Turnstile).
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To pass your enquiry to the relevant dealer.</li>
            <li>
              To send you an instant acknowledgement that your enquiry was
              received. This acknowledgement is a fixed template — it is not
              written by an AI model.
            </li>
            <li>
              To prepare a suggested reply for the dealer. A dealer always reviews
              and approves a reply before it is sent to you.
            </li>
            <li>
              To measure response times, which we publish only in aggregate and
              never in a way that identifies you.
            </li>
          </ul>
        </Section>

        <Section title="Automated assistance (AI)">
          <p>
            Part of the reply flow uses an automated assistant to draft
            suggestions. It is clearly labelled as an AI assistant wherever you
            interact with it, and a human at the dealership approves any free-text
            reply before it reaches you. The assistant does not make decisions
            about you on its own.
          </p>
        </Section>

        <Section title="How long we keep raw emails">
          <p>
            When an enquiry arrives by forwarded email, we keep the original email
            for up to 30 days to diagnose delivery or parsing problems, then it is
            automatically deleted. The enquiry record itself (so the dealer can
            keep helping you) is retained separately.
          </p>
        </Section>

        <Section title="Who we share it with">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The dealer whose car you enquired on.</li>
            <li>
              Service providers who help us operate: email delivery (Resend),
              hosting and database (Cloudflare, Supabase). They process data on our
              behalf.
            </li>
            <li>We do not sell your personal information.</li>
          </ul>
        </Section>

        <Section title="Your choices">
          <p>
            You can ask us for a copy of the information we hold about you, or ask
            us to delete it. To do that, or to ask anything about this page, email{" "}
            <span className="font-medium text-slate-900">
              privacy@usedcarsnz.co.nz
            </span>{" "}
            <em>(placeholder address — confirm before launch)</em>.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            UsedCarsNZ — contact details to be confirmed before launch. This
            section, and this entire page, are placeholders awaiting legal review.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
