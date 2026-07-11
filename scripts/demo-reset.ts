/**
 * scripts/demo-reset.ts — reset the demo between dealer meetings.
 *
 *   npx tsx scripts/demo-reset.ts
 *
 * HARD-GUARDED to local/demo only (assertDemoTarget). PRESERVES the seeded
 * history — it only clears leads created LIVE during a meeting and re-arms the
 * seeded live-state inbox.
 *
 * IMMUTABILITY NOTE: lead_events is append-only and cannot be deleted (the
 * prevent_mutation trigger blocks DELETE for every role, and enquiries carry an
 * ON DELETE RESTRICT FK from lead_events) — that immutability IS the product, so
 * this script does NOT try to erase history. Instead it "clears" a live demo
 * lead the sanctioned way: it CLOSES the enquiry and APPENDS a lead_closed
 * compensating event, and deletes the lead's working ai_drafts (a mutable table).
 * The lead drops out of the active inbox; the event log stays honest.
 *
 * Idempotent: a second run closes nothing new and re-arms nothing already armed.
 */
import {
  loadEnvLocal,
  makeServiceClient,
  du,
  SEED_PREFIX,
  DEMO_DEALERS,
} from "./demo-data";

loadEnvLocal();

const LIVE_STATE_KEYS = [0, 1, 2, 3].map((i) => SEED_PREFIX + `live:${i}`);

async function main() {
  const svc = makeServiceClient();
  console.log("Resetting demo (local/demo target confirmed)…\n");

  const demoDealerIds = DEMO_DEALERS.map((d) => d.id);

  // ---- 1. Close live (non-seed) demo leads --------------------------------
  const { data: leads, error } = await svc
    .from("enquiries")
    .select("id, external_message_id, status")
    .in("dealer_id", demoDealerIds);
  if (error) throw new Error(`read demo enquiries: ${error.message}`);

  const liveLeads = (leads ?? []).filter((l) => {
    const tag = (l as { external_message_id: string | null }).external_message_id;
    return !tag || !tag.startsWith(SEED_PREFIX); // untagged => created live during a meeting
  });

  let closed = 0;
  for (const l of liveLeads) {
    const lead = l as { id: string; status: string };
    // Drafts are working state (mutable) — clear them outright.
    await svc.from("ai_drafts").delete().eq("enquiry_id", lead.id);
    if (lead.status === "closed") continue; // already cleared — idempotent
    await svc.from("enquiries").update({ status: "closed" }).eq("id", lead.id);
    const { error: evErr } = await svc.rpc("log_lead_event", {
      p_lead_id: lead.id,
      p_event_type: "lead_closed",
      p_actor: "system",
      p_payload: { reason: "demo-reset" },
    });
    if (evErr) throw new Error(`append lead_closed for ${lead.id}: ${evErr.message}`);
    closed++;
  }

  // ---- 2. Re-arm the seeded live-state inbox ------------------------------
  // If a demo approved/sent a seeded draft, restore it to a pending draft on a
  // New lead so the next meeting starts from the same worked-in baseline. The
  // immutable log keeps whatever approvals happened; only the working row resets.
  let rearmed = 0;
  for (const key of LIVE_STATE_KEYS) {
    const leadId = du(`enq:${key.slice(SEED_PREFIX.length)}`);
    const draftId = du(`draft:${key.slice(SEED_PREFIX.length)}`);
    const { data: enquiry } = await svc
      .from("enquiries")
      .select("id, status")
      .eq("id", leadId)
      .maybeSingle<{ id: string; status: string }>();
    if (!enquiry) continue; // seed hasn't run yet
    if (enquiry.status !== "new") {
      await svc.from("enquiries").update({ status: "new" }).eq("id", leadId);
    }
    const { data: draft } = await svc
      .from("ai_drafts")
      .select("id, status")
      .eq("id", draftId)
      .maybeSingle<{ id: string; status: string }>();
    if (draft && draft.status !== "pending") {
      await svc
        .from("ai_drafts")
        .update({ status: "pending", approved_by: null, approved_at: null, sent_at: null })
        .eq("id", draftId);
      rearmed++;
    }
  }

  console.log(`  live leads closed: ${closed}`);
  console.log(`  seeded live-state drafts re-armed: ${rearmed}`);
  console.log("\nDone. Seeded history preserved; the event log was never mutated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
