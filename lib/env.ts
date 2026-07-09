import { z } from "zod";

/**
 * Typed environment loader (ported from the WP-0 scaffold).
 *
 * One typed source of truth for every environment variable the marketplace
 * reads. The landing page's /api/lead route reads its own vars directly and is
 * deliberately NOT routed through here — it stays exactly as shipped.
 *
 * Validation is LAZY: it runs the first time getClientEnv()/getServerEnv() is
 * called, never at import or build time, so `next build` stays green against
 * an empty environment. Set SKIP_ENV_VALIDATION=1 to bypass entirely.
 *
 * Deviation from the WP-2/3 zip (deliberate): NEXT_PUBLIC_SITE_URL now
 * defaults to the production URL instead of being required, because the live
 * deployment predates this variable and must not start throwing when the
 * marketplace routes land.
 */

const APP_ENVS = ["local", "dev", "demo", "production"] as const;

const clientSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVS).default("production"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("https://usedcarsnz.co.nz"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Same Cloudflare Turnstile site as the landing page's /api/lead widget
  // (which reads this directly from process.env, per lib/env.ts's module
  // comment) — one Turnstile site covers both pages, so POST /api/enquiries
  // reuses it rather than requiring a second widget registration.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional().default(""),
});

const AI_PROVIDERS = ["workers-ai", "anthropic"] as const;

const serverSchema = z.object({
  // Server-only secrets.
  SUPABASE_SECRET_KEY: z.string().min(1).optional().default(""),
  RESEND_API_KEY: z.string().min(1).optional().default(""),
  OPENAI_API_KEY: z.string().min(1).optional().default(""),
  // Verifies NEXT_PUBLIC_TURNSTILE_SITE_KEY tokens for POST /api/enquiries.
  TURNSTILE_SECRET_KEY: z.string().min(1).optional().default(""),

  // Bounded AI layer (strategy §7) — provider/model are per-lane so either
  // lane can be flipped to the Anthropic escalation path independently.
  AI_PROVIDER_QUALIFY: z.enum(AI_PROVIDERS).default("workers-ai"),
  AI_PROVIDER_DRAFT: z.enum(AI_PROVIDERS).default("workers-ai"),
  AI_MODEL_QUALIFY: z.string().min(1).default("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  AI_MODEL_DRAFT: z.string().min(1).default("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema> & ClientEnv;

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

let clientCache: ClientEnv | null = null;
let serverCache: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function readClient(): ClientEnv {
  // Reference NEXT_PUBLIC_* literally so Next can statically inline them.
  const raw = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  if (skipValidation) return raw as unknown as ClientEnv;

  const hasSupabaseConfig = Boolean(raw.NEXT_PUBLIC_SUPABASE_URL && raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!hasSupabaseConfig) {
    return {
      NEXT_PUBLIC_APP_ENV: raw.NEXT_PUBLIC_APP_ENV ?? "production",
      NEXT_PUBLIC_SITE_URL: raw.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz",
      NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    } as ClientEnv;
  }

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

function readServer(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in client code.");
  }
  const client = readClient();
  const raw = {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_PROVIDER_QUALIFY: process.env.AI_PROVIDER_QUALIFY,
    AI_PROVIDER_DRAFT: process.env.AI_PROVIDER_DRAFT,
    AI_MODEL_QUALIFY: process.env.AI_MODEL_QUALIFY,
    AI_MODEL_DRAFT: process.env.AI_MODEL_DRAFT,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
  if (skipValidation) return { ...client, ...raw } as ServerEnv;

  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return { ...client, ...parsed.data };
}

/** Public env, safe on client and server. Validated + memoized on first call. */
export function getClientEnv(): ClientEnv {
  clientCache ??= readClient();
  return clientCache;
}

/** Server-only env (secrets). Throws if called from the browser. */
export function getServerEnv(): ServerEnv {
  serverCache ??= readServer();
  return serverCache;
}
