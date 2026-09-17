/**
 * scripts/latency-check.ts — latency budget gate for the DEPLOYED demo.
 *
 *   npx tsx scripts/latency-check.ts
 *
 * Hits the demo-path URLs on the live demo environment N times each, prints
 * p50/p75/p95 per route, and EXITS NON-ZERO if any route breaches its budget.
 * The demo sits behind Cloudflare Access, so every request carries the Access
 * service-token headers — without them the edge 403s before reaching the app.
 *
 * Budgets (from the Prompt-7 brief):
 *   - search  (/cars)              p75 < 1500ms
 *   - listing (/cars/.../<id>)     p75 < 1500ms
 *   - dashboard (/dealer/metrics)  p75 < 1000ms   (needs an authed session cookie)
 *   - enquiry POST (/api/enquiries) p95 < 1000ms  (optional; inserts rows)
 *
 * Config via env (export before running, or put in .env.local):
 *   LATENCY_TARGET_URL            target host (default: DEMO_URL). Point at
 *                                 http://localhost:3000 to run against local dev.
 *   DEMO_URL                      https://demo.usedcarsnz.co.nz   (the demo target)
 *   CF_ACCESS_CLIENT_ID           Access service-token id  (required unless local)
 *   CF_ACCESS_CLIENT_SECRET       Access service-token secret (required unless local)
 *   LATENCY_SAMPLES               iterations per route (default 20)
 *   DEMO_LISTING_PATH             /cars/toyota/aqua/2016/<uuid>   (else listing SKIP)
 *   DEMO_SESSION_COOKIE           Cookie header for an authed dealer (else dashboard SKIP)
 *   DEMO_ENQUIRY_LISTING_ID       a listing uuid to POST an enquiry against (else POST SKIP)
 *   DEMO_ENQUIRY_TOKEN            a FRESH Turnstile token for that POST (single-use)
 *
 * This is founder-executed against the live demo — it cannot run from a sandbox
 * with no route to the demo host or no service token.
 */
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — use ambient env */
  }
}
loadEnvLocal();

// LATENCY_TARGET_URL wins so the check can point at local dev; DEMO_URL is the
// default (the deployed, Access-gated demo).
const DEMO_URL = (process.env.LATENCY_TARGET_URL ?? process.env.DEMO_URL ?? "").replace(/\/$/, "");
const CF_ID = process.env.CF_ACCESS_CLIENT_ID ?? "";
const CF_SECRET = process.env.CF_ACCESS_CLIENT_SECRET ?? "";
const SAMPLES = Math.max(5, Number(process.env.LATENCY_SAMPLES ?? 20));

// Local dev is not behind Cloudflare Access, so the service-token headers are
// neither required nor sent. Any other host is treated as Access-gated.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(DEMO_URL);

if (!DEMO_URL) {
  console.error("\nSTOP: set LATENCY_TARGET_URL (or DEMO_URL) to the host to probe.\n");
  process.exit(2);
}
if (!isLocal && (!CF_ID || !CF_SECRET)) {
  console.error(
    `\nSTOP: ${DEMO_URL} is behind Cloudflare Access — set CF_ACCESS_CLIENT_ID and\n` +
      "CF_ACCESS_CLIENT_SECRET, or point LATENCY_TARGET_URL at local dev (localhost).\n",
  );
  process.exit(2);
}

// Only send the Access headers when we have them (i.e. against the gated demo).
const accessHeaders: Record<string, string> =
  CF_ID && CF_SECRET
    ? { "CF-Access-Client-Id": CF_ID, "CF-Access-Client-Secret": CF_SECRET }
    : {};

type Percentile = "p75" | "p95";
interface RouteCheck {
  name: string;
  method: "GET" | "POST";
  url: string;
  budgetMs: number;
  gateOn: Percentile;
  headers?: Record<string, string>;
  body?: string;
  skip?: string; // reason, if this route can't be measured
  // The enquiry POST carries a single-use Turnstile token, so it is measured
  // once (no warm-up, no loop) rather than sampled N times.
  singleShot?: boolean;
}

function buildChecks(): RouteCheck[] {
  const checks: RouteCheck[] = [
    { name: "search   (/cars)", method: "GET", url: `${DEMO_URL}/cars`, budgetMs: 1500, gateOn: "p75" },
  ];

  const listingPath = process.env.DEMO_LISTING_PATH;
  checks.push({
    name: "listing  (detail)",
    method: "GET",
    url: listingPath ? `${DEMO_URL}${listingPath}` : "",
    budgetMs: 1500,
    gateOn: "p75",
    skip: listingPath ? undefined : "DEMO_LISTING_PATH not set",
  });

  const cookie = process.env.DEMO_SESSION_COOKIE;
  checks.push({
    name: "dashboard (/dealer/metrics)",
    method: "GET",
    url: `${DEMO_URL}/dealer/metrics`,
    budgetMs: 1000,
    gateOn: "p75",
    headers: cookie ? { cookie } : undefined,
    skip: cookie ? undefined : "DEMO_SESSION_COOKIE not set (dashboard needs auth)",
  });

  const enquiryListing = process.env.DEMO_ENQUIRY_LISTING_ID;
  const enquiryToken = process.env.DEMO_ENQUIRY_TOKEN;
  const canPost = Boolean(enquiryListing && enquiryToken);
  checks.push({
    name: "enquiry  (POST)",
    method: "POST",
    url: `${DEMO_URL}/api/enquiries`,
    budgetMs: 1000,
    gateOn: "p95",
    singleShot: true,
    headers: { "content-type": "application/json" },
    body: canPost
      ? JSON.stringify({
          // Field names match app/api/enquiries/route.ts exactly.
          listing_id: enquiryListing,
          name: "Latency Check",
          email: "latency-check@example.com",
          message: "Automated latency probe — safe to ignore.",
          token: enquiryToken, // single-use Turnstile token
          website: "", // honeypot must be empty
        })
      : undefined,
    skip: canPost
      ? undefined
      : "set DEMO_ENQUIRY_LISTING_ID + a FRESH DEMO_ENQUIRY_TOKEN (POST inserts a row; run demo-reset after)",
  });

  return checks;
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return NaN;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

async function timeOnce(check: RouteCheck): Promise<number> {
  const start = performance.now();
  const res = await fetch(check.url, {
    method: check.method,
    headers: { ...accessHeaders, ...(check.headers ?? {}) },
    body: check.body,
  });
  // Drain the body so we measure full response time, not just headers.
  await res.arrayBuffer();
  if (res.status >= 500) throw new Error(`${check.name}: HTTP ${res.status}`);
  return performance.now() - start;
}

async function measure(check: RouteCheck): Promise<{ p50: number; p75: number; p95: number }> {
  if (check.singleShot) {
    // Single-use token: exactly one request, reported as all three percentiles.
    const t = await timeOnce(check);
    return { p50: t, p75: t, p95: t };
  }
  const samples: number[] = [];
  // One warm-up (ISR/edge cold cache) that doesn't count.
  await timeOnce(check).catch(() => {});
  for (let i = 0; i < SAMPLES; i++) samples.push(await timeOnce(check));
  samples.sort((a, b) => a - b);
  return { p50: percentile(samples, 50), p75: percentile(samples, 75), p95: percentile(samples, 95) };
}

function ms(n: number): string {
  return Number.isFinite(n) ? `${Math.round(n)}ms` : "—";
}

async function main() {
  console.log(`\nLatency check → ${DEMO_URL}  (${SAMPLES} samples/route, +1 warm-up)\n`);
  const header = "route".padEnd(22) + "p50".padStart(8) + "p75".padStart(8) + "p95".padStart(8) + "  budget      result";
  console.log(header);
  console.log("-".repeat(header.length));

  let breached = false;
  for (const check of buildChecks()) {
    if (check.skip) {
      console.log(check.name.padEnd(22) + "SKIP".padStart(8) + " ".repeat(16) + `  —           ${check.skip}`);
      continue;
    }
    let stats;
    try {
      stats = await measure(check);
    } catch (err) {
      breached = true;
      console.log(check.name.padEnd(22) + `ERROR — ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const gateValue = check.gateOn === "p75" ? stats.p75 : stats.p95;
    const pass = gateValue < check.budgetMs;
    if (!pass) breached = true;
    const budget = `${check.gateOn}<${check.budgetMs}ms`;
    console.log(
      check.name.padEnd(22) +
        ms(stats.p50).padStart(8) +
        ms(stats.p75).padStart(8) +
        ms(stats.p95).padStart(8) +
        `  ${budget.padEnd(11)} ${pass ? "PASS" : "FAIL"}`,
    );
  }

  console.log("");
  if (breached) {
    console.error("Latency budget BREACHED.\n");
    process.exit(1);
  }
  console.log("All measured routes within budget.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
