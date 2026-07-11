/**
 * Shared demo-seed infrastructure for scripts/seed-demo.ts + scripts/demo-reset.ts.
 *
 * HARD SAFETY GUARD: both scripts refuse to run unless the target is a LOCAL or
 * DEMO Supabase. The guard is asserted here, in code — not by convention — and
 * checks BOTH the app environment AND the URL, and refuses outright if the URL
 * looks like the known production project. There is no override flag.
 *
 * Runs outside Next (via tsx), so it loads .env.local itself and talks to the
 * service-role PostgREST client directly, exactly like scripts/timing-check.ts
 * and scripts/inbound-e2e.ts. Nothing here imports @/lib (no server-only, no
 * Next alias) so it stays a plain Node script.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The production Supabase project ref (from .env.example). The guard refuses any
// URL containing this, belt-and-braces on top of the env/URL checks.
const PROD_PROJECT_REFS = ["geappcqiihbgihcsitkj"];

/** Everything this session creates is tagged with this prefix on
 * enquiries.external_message_id, so the seed is idempotent and demo-reset can
 * tell seeded history apart from leads created live during a meeting. */
export const SEED_PREFIX = "demo-seed:";

export function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — fall through to the ambient environment
  }
}

/**
 * PURE guard evaluation (unit-testable, no process side effects). Returns ok, or
 * a specific refusal reason. The rules: a secret key and URL must be present, the
 * URL must not be the known production project, the app env must be local/demo,
 * and an app env of 'local' must be paired with a local URL.
 */
export function checkDemoTarget(env: {
  url?: string;
  appEnv?: string;
  secretKey?: string;
}): { ok: true } | { ok: false; reason: string } {
  const url = (env.url ?? "").trim();
  const appEnv = (env.appEnv ?? "").trim();
  const secretKey = (env.secretKey ?? "").trim();

  if (!url) return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is unset" };
  if (!secretKey) return { ok: false, reason: "SUPABASE_SECRET_KEY is unset" };
  if (PROD_PROJECT_REFS.some((ref) => url.includes(ref))) {
    return { ok: false, reason: "target URL is the PRODUCTION Supabase project" };
  }
  if (appEnv === "production") {
    return { ok: false, reason: "NEXT_PUBLIC_APP_ENV is 'production'" };
  }
  if (appEnv !== "local" && appEnv !== "demo") {
    return { ok: false, reason: "NEXT_PUBLIC_APP_ENV must be 'local' or 'demo'" };
  }
  const isLocalUrl = /127\.0\.0\.1|localhost|:54321/.test(url);
  if (appEnv === "local" && !isLocalUrl) {
    return { ok: false, reason: "NEXT_PUBLIC_APP_ENV is 'local' but the URL is not a local Supabase" };
  }
  return { ok: true };
}

/**
 * Refuse to run against anything that isn't demonstrably local/demo. Exits
 * non-zero with a specific reason. This is the invariant-6 / deliverable-E
 * guard: the script can NEVER touch production.
 */
export function assertDemoTarget(): { url: string; secretKey: string } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "").trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? "").trim();

  const verdict = checkDemoTarget({ url, appEnv, secretKey });
  if (!verdict.ok) {
    console.error(`\nREFUSING TO RUN — ${verdict.reason}`);
    console.error(`  NEXT_PUBLIC_APP_ENV = ${appEnv || "(unset)"}`);
    console.error(`  NEXT_PUBLIC_SUPABASE_URL = ${url || "(unset)"}`);
    console.error("  Demo scripts run ONLY against a local or demo Supabase.\n");
    process.exit(1);
  }
  return { url, secretKey };
}

export function makeServiceClient(): SupabaseClient {
  const { url, secretKey } = assertDemoTarget();
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deterministic UUID from a stable key, so re-running the seed is idempotent
 * and produces identical ids (no random drift between runs). */
export function du(key: string): string {
  const h = createHash("sha1").update("usedcarsnz-demo:" + key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Tiny deterministic PRNG (mulberry32) so the seeded funnel is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoDealer {
  idx: number;
  id: string;
  ownerEmail: string;
  ownerName: string;
  businessName: string;
  contactName: string;
  email: string;
  suburb: string;
  city: string;
  region: string;
}

export const DEMO_DEALERS: DemoDealer[] = [
  {
    idx: 1,
    id: du("dealer:1"),
    ownerEmail: "demo-dealer-1@usedcarsnz.demo",
    ownerName: "Aroha Mātai",
    businessName: "Harbour City Motors",
    contactName: "Aroha Mātai",
    email: "sales@harbourcitymotors.demo",
    suburb: "Petone",
    city: "Lower Hutt",
    region: "Wellington",
  },
  {
    idx: 2,
    id: du("dealer:2"),
    ownerEmail: "demo-dealer-2@usedcarsnz.demo",
    ownerName: "Sione Tuʻipulotu",
    businessName: "Southern Cross Autos",
    contactName: "Sione Tuʻipulotu",
    email: "sales@southerncrossautos.demo",
    suburb: "Riccarton",
    city: "Christchurch",
    region: "Canterbury",
  },
  {
    idx: 3,
    id: du("dealer:3"),
    ownerEmail: "demo-dealer-3@usedcarsnz.demo",
    ownerName: "Priya Nair",
    businessName: "Queen Street Vehicles",
    contactName: "Priya Nair",
    email: "sales@queenstreetvehicles.demo",
    suburb: "Penrose",
    city: "Auckland",
    region: "Auckland",
  },
];

export interface DemoVehicle {
  make: string;
  model: string;
  year: number;
  variant: string | null;
  bodyType: string;
  fuel: "petrol" | "diesel" | "hybrid" | "phev" | "ev" | "other";
  transmission: "manual" | "automatic" | "other";
  odometerKm: number;
  colour: string;
  price: number;
}

/** Realistic NZ used-car pool across price bands (cheap runabout -> ute -> EV). */
export const VEHICLE_POOL: DemoVehicle[] = [
  { make: "Toyota", model: "Corolla", year: 2018, variant: "GX Hatch", bodyType: "hatch", fuel: "petrol", transmission: "automatic", odometerKm: 72000, colour: "Silver", price: 19990 },
  { make: "Toyota", model: "Aqua", year: 2016, variant: "S", bodyType: "hatch", fuel: "hybrid", transmission: "automatic", odometerKm: 88000, colour: "White", price: 14990 },
  { make: "Toyota", model: "Hilux", year: 2019, variant: "SR5 2.8TD", bodyType: "ute", fuel: "diesel", transmission: "automatic", odometerKm: 96000, colour: "Grey", price: 42990 },
  { make: "Toyota", model: "RAV4", year: 2020, variant: "GX Hybrid", bodyType: "suv", fuel: "hybrid", transmission: "automatic", odometerKm: 61000, colour: "Blue", price: 39990 },
  { make: "Mazda", model: "Axela", year: 2017, variant: "20S", bodyType: "hatch", fuel: "petrol", transmission: "automatic", odometerKm: 79000, colour: "Red", price: 17990 },
  { make: "Mazda", model: "CX-5", year: 2018, variant: "GSX", bodyType: "suv", fuel: "petrol", transmission: "automatic", odometerKm: 84000, colour: "Machine Grey", price: 27990 },
  { make: "Honda", model: "Fit", year: 2015, variant: "Hybrid", bodyType: "hatch", fuel: "hybrid", transmission: "automatic", odometerKm: 102000, colour: "Silver", price: 12990 },
  { make: "Honda", model: "CR-V", year: 2019, variant: "Sport", bodyType: "suv", fuel: "petrol", transmission: "automatic", odometerKm: 68000, colour: "Black", price: 31990 },
  { make: "Ford", model: "Ranger", year: 2020, variant: "XLT 2.0 BiTurbo", bodyType: "ute", fuel: "diesel", transmission: "automatic", odometerKm: 74000, colour: "Arctic White", price: 46990 },
  { make: "Nissan", model: "Leaf", year: 2019, variant: "40kWh", bodyType: "hatch", fuel: "ev", transmission: "automatic", odometerKm: 41000, colour: "White", price: 26990 },
  { make: "Suzuki", model: "Swift", year: 2019, variant: "GLX", bodyType: "hatch", fuel: "petrol", transmission: "automatic", odometerKm: 55000, colour: "Yellow", price: 16990 },
  { make: "Kia", model: "Sportage", year: 2018, variant: "LX", bodyType: "suv", fuel: "petrol", transmission: "automatic", odometerKm: 90000, colour: "Silver", price: 23990 },
  { make: "Hyundai", model: "Tucson", year: 2019, variant: "2.0", bodyType: "suv", fuel: "petrol", transmission: "automatic", odometerKm: 77000, colour: "Grey", price: 25990 },
  { make: "Mitsubishi", model: "Outlander", year: 2017, variant: "VRX PHEV", bodyType: "suv", fuel: "phev", transmission: "automatic", odometerKm: 98000, colour: "Black", price: 22990 },
  { make: "Subaru", model: "Outback", year: 2018, variant: "3.6R", bodyType: "wagon", fuel: "petrol", transmission: "automatic", odometerKm: 86000, colour: "Blue", price: 28990 },
  { make: "Volkswagen", model: "Golf", year: 2017, variant: "TSI", bodyType: "hatch", fuel: "petrol", transmission: "automatic", odometerKm: 81000, colour: "White", price: 18990 },
  { make: "Tesla", model: "Model 3", year: 2021, variant: "Standard Range Plus", bodyType: "sedan", fuel: "ev", transmission: "automatic", odometerKm: 38000, colour: "Pearl White", price: 52990 },
  { make: "Holden", model: "Commodore", year: 2016, variant: "SV6", bodyType: "sedan", fuel: "petrol", transmission: "automatic", odometerKm: 118000, colour: "Red", price: 15990 },
  { make: "BMW", model: "320i", year: 2017, variant: "Sport Line", bodyType: "sedan", fuel: "petrol", transmission: "automatic", odometerKm: 72000, colour: "Black", price: 27990 },
  { make: "Toyota", model: "Land Cruiser Prado", year: 2018, variant: "VX", bodyType: "suv", fuel: "diesel", transmission: "automatic", odometerKm: 94000, colour: "White", price: 54990 },
];
