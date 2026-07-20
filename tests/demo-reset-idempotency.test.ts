/**
 * demo:reset idempotency (PROMPT-T3): the reset is safe to run twice — the
 * second run closes 0 leads and re-arms 0 drafts, and a lead's event history
 * is never deleted (the log only grows; immutability itself is proven by
 * tests/db-invariants). Env-gated to the local stack like its siblings, and
 * additionally SKIPS when the demo seed hasn't been run (CI seeds first).
 *
 * Assertions are scoped to a lead THIS test creates, so parallel Vitest
 * workers (the db-invariants suite appends its own events) can't flake it.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { isLocal, url, secretKey, serviceClient } from "./db-invariants/helpers";
import { DEMO_DEALERS } from "@/scripts/demo-data";

function runReset(): { closed: number; rearmed: number } {
  const out = execFileSync("npx", ["tsx", "scripts/demo-reset.ts"], {
    shell: true, // npx is a .cmd shim on Windows
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_ENV: "local",
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secretKey,
    },
  });
  const closed = Number(/live leads closed: (\d+)/.exec(out)?.[1] ?? NaN);
  const rearmed = Number(/re-armed: (\d+)/.exec(out)?.[1] ?? NaN);
  if (Number.isNaN(closed) || Number.isNaN(rearmed)) {
    throw new Error(`could not parse demo-reset output:\n${out}`);
  }
  return { closed, rearmed };
}

describe.skipIf(!isLocal)("demo:reset idempotency", () => {
  it("second run closes 0 / re-arms 0, and a lead's events are never deleted", async () => {
    const svc = serviceClient();

    // Needs the demo seed (a demo-dealer listing to hang a "live" lead off).
    const { data: listing } = await svc
      .from("listings")
      .select("id")
      .eq("dealer_id", DEMO_DEALERS[0].id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!listing) {
      console.warn("demo-reset test: demo seed not present — skipping.");
      return;
    }

    // A lead "created live during a meeting": untagged (no seed prefix).
    const leadId = crypto.randomUUID();
    const { error: insErr } = await svc.from("enquiries").insert({
      id: leadId,
      listing_id: listing.id,
      buyer_name: "Reset Idempotency Buyer",
      buyer_email: "reset-idempotency@example.com",
      status: "new",
    });
    expect(insErr).toBeNull();
    const { error: draftErr } = await svc
      .from("ai_drafts")
      .insert({ enquiry_id: leadId, draft_text: "live-demo draft", status: "pending" });
    expect(draftErr).toBeNull();

    const countEvents = async (): Promise<number> => {
      const { count, error } = await svc
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const before = await countEvents(); // enquiry_received

    // First reset: closes OUR live lead (appending lead_closed), deletes its draft.
    const first = runReset();
    expect(first.closed).toBeGreaterThanOrEqual(1);

    const afterFirst = await countEvents();
    expect(afterFirst, "closing must APPEND (lead_closed), never delete").toBeGreaterThan(before);

    const { data: lead } = await svc
      .from("enquiries")
      .select("status")
      .eq("id", leadId)
      .single<{ status: string }>();
    expect(lead?.status).toBe("closed");
    const { data: drafts } = await svc.from("ai_drafts").select("id").eq("enquiry_id", leadId);
    expect(drafts?.length ?? 0, "the live lead's working draft is cleared").toBe(0);

    // Second reset: nothing left to do — and the lead's history is untouched.
    const second = runReset();
    expect(second.closed, "second run must close 0 leads").toBe(0);
    expect(second.rearmed, "second run must re-arm 0 drafts").toBe(0);
    expect(await countEvents(), "event history only ever grows").toBe(afterFirst);
  }, 120_000);
});
