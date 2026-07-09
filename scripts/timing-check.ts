// Posts N synthetic enquiries against a running dev server, reads back
// lead_events, and prints the enquiry_received -> ack_sent delta per lead
// plus p50/p95 — the verification gate for the sub-60s (here: sub-5s local)
// first-touch SLA (strategy §3 / this session's brief).
//
// Usage:
//   npm run dev                                   # in one terminal
//   tsx scripts/timing-check.ts --n 20             # in another
//
// Requires (in .env.local or the environment):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY  — to read lead_events back
//   TURNSTILE_SECRET_KEY on the SERVER must be set to Cloudflare's testing
//   "always passes" secret (1x0000000000000000000000000000AA) — this script
//   sends Cloudflare's matching testing token, which only that test secret
//   accepts; a real production secret will reject it and every request will
//   400 on Turnstile verification.
import { createClient } from "@supabase/supabase-js";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // no .env.local — fall through to whatever is already in the environment
  }
}

const BASE_URL = argValue("--base") ?? process.env.TIMING_CHECK_BASE_URL ?? "http://localhost:3000";
const N = Number(argValue("--n") ?? 20);
// Cloudflare's documented "always passes" Turnstile test token.
const TEST_TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const svc = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

  const { data: listing, error: listingError } = await svc
    .from("listings")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single<{ id: string }>();
  if (listingError || !listing) {
    console.error("No active listing found to enquire against:", listingError?.message);
    process.exit(1);
  }

  console.log(`Posting ${N} synthetic enquiries to ${BASE_URL}/api/enquiries ...`);
  const enquiryIds: string[] = [];

  for (let i = 0; i < N; i++) {
    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id: listing.id,
        name: `Timing Check ${i}`,
        email: `timing-check-${Date.now()}-${i}@example.com`,
        message: "Synthetic load-test enquiry from scripts/timing-check.ts",
        website: "",
        token: TEST_TURNSTILE_TOKEN,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; enquiryId?: string; error?: string };
    if (!res.ok || !body.ok || !body.enquiryId) {
      console.error(`  [${i}] FAILED: ${res.status} ${body.error ?? "unknown error"}`);
      continue;
    }
    enquiryIds.push(body.enquiryId);
  }

  console.log(`${enquiryIds.length}/${N} enquiries accepted. Reading lead_events ...`);

  const deltas: number[] = [];
  for (const id of enquiryIds) {
    // ack_sent is written synchronously before POST /api/enquiries responds,
    // so a single read is normally enough; a short retry covers replication lag.
    let events: { event_type: string; occurred_at: string }[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data } = await svc
        .from("lead_events")
        .select("event_type, occurred_at")
        .eq("lead_id", id)
        .in("event_type", ["enquiry_received", "ack_sent"]);
      events = data ?? [];
      if (events.some((e) => e.event_type === "ack_sent")) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    const received = events.find((e) => e.event_type === "enquiry_received");
    const ack = events.find((e) => e.event_type === "ack_sent");
    if (!received || !ack) {
      console.error(`  ${id}: missing event(s) — received=${!!received} ack_sent=${!!ack}`);
      continue;
    }
    const delta = new Date(ack.occurred_at).getTime() - new Date(received.occurred_at).getTime();
    deltas.push(delta);
    console.log(`  ${id}: ${delta}ms`);
  }

  if (deltas.length === 0) {
    console.error("No deltas recorded — nothing to report.");
    process.exit(1);
  }

  deltas.sort((a, b) => a - b);
  const p50 = percentile(deltas, 0.5);
  const p95 = percentile(deltas, 0.95);
  const over5s = deltas.filter((d) => d >= 5000);

  console.log(`\np50 = ${p50}ms, p95 = ${p95}ms, n = ${deltas.length}`);
  if (over5s.length > 0) {
    console.error(`FAIL: ${over5s.length} delta(s) >= 5000ms`);
    process.exit(1);
  }
  console.log("PASS: every delta < 5000ms");
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
