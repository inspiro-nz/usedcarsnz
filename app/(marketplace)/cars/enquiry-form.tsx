import { EnquiryFormClient } from "./enquiry-form-client";

/**
 * Server Component — reads the Turnstile site key at request time and passes
 * it to the client as a prop (same reasoning as components/PilotForm.tsx:
 * avoids relying on Next.js build-time NEXT_PUBLIC_ inlining, which is
 * unreliable in Cloudflare Pages builds where env vars may not be available
 * to the bundler).
 */
export function EnquiryForm({ listingId }: { listingId: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return <EnquiryFormClient listingId={listingId} siteKey={siteKey} />;
}
