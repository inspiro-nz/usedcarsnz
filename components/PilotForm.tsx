import PilotFormClient from '@/components/PilotFormClient'

// Server Component — reads env var at request time, passes to client as a prop.
// Avoids relying on Next.js build-time NEXT_PUBLIC_ inlining, which is unreliable
// in Cloudflare Pages builds where env vars may not be available to the bundler.
export default function PilotForm() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
  return <PilotFormClient siteKey={siteKey} />
}
