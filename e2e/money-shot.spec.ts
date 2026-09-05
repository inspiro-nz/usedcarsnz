import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The money shot (DEMO_RUNBOOK §3) as one real-browser journey:
 *
 *   buyer enquires → instant ack pipeline engages → lead in the dealer inbox
 *   → AI draft awaits approval (labelled, NOT sent) → dealer edits a line →
 *   Approve & send → status flips to sent → timeline shows the approval.
 *
 * Two browser contexts: an anonymous buyer and the signed-in E2E dealer
 * (provisioned by `npm run e2e:setup` with E2E_DEALER_EMAIL/PASSWORD — the
 * dealer OWNS the fixture dealership; see scripts/ensure-e2e-user.ts).
 *
 * AI lanes: no live model anywhere. The qualification trigger fails closed
 * without the Cloudflare AI binding, and the draft the dealer approves is
 * inserted by THIS spec via the service role — a deterministic stand-in for
 * generateDraft's output, so the approval gate (the compliance-visible part)
 * is exercised without spending tokens or flaking on a model.
 *
 * Ack evidence is environment-robust: with an email provider configured the
 * ack_sent lead_event exists; offline (CI) the templated ack is parked in
 * email_outbox instead (first-touch behaviour) — the spec accepts either,
 * and asserts the evidence PRE-DATES the approval (ack before approval).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const DEALER_EMAIL = process.env.E2E_DEALER_EMAIL;
const DEALER_PASSWORD = process.env.E2E_DEALER_PASSWORD;

const isLocalStack = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl) && Boolean(secretKey);
const MISSING =
  "Money-shot spec needs a LOCAL stack + SUPABASE_SECRET_KEY + E2E_DEALER_EMAIL/PASSWORD, " +
  "and `npm run e2e:setup` run first (see docs/testing.md).";

/** Mirrors scripts/ensure-e2e-user.ts e2eId() — the fixture listing's id. */
function e2eId(key: string): string {
  const h = createHash("sha1").update("usedcarsnz-e2e:" + key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const LISTING_URL = `/cars/honda/jazz/2019/${e2eId("listing")}`;

const DRAFT_TEXT =
  "Kia ora! Yes, the Jazz is still available. We're open 9–5:30 weekdays and " +
  "10–4 Saturdays — happy to hold a time for you to view. What day suits?";
const EDIT_LINE = "P.S. Ask for Sam at the front desk — edited by a human.";

async function poll<T>(fn: () => Promise<T | null>, what: string, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Earliest occurred_at per event type for a lead. */
async function eventTimes(svc: SupabaseClient, leadId: string): Promise<Map<string, number>> {
  const { data, error } = await svc
    .from("lead_events")
    .select("event_type, occurred_at")
    .eq("lead_id", leadId);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const t = new Date(row.occurred_at as string).getTime();
    const cur = map.get(row.event_type as string);
    if (cur === undefined || t < cur) map.set(row.event_type as string, t);
  }
  return map;
}

test.describe("money shot: enquiry → ack → inbox → approve → sent", () => {
  test.skip(!isLocalStack || !DEALER_EMAIL || !DEALER_PASSWORD, MISSING);

  test("the full demo choreography holds in one browser journey", async ({ browser }) => {
    test.setTimeout(180_000);
    const svc = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const buyerName = `E2E Buyer ${Date.now()}`;

    // ─── Buyer context: enquire on the fixture listing ────────────────────
    const buyerCtx = await browser.newContext();
    const bp = await buyerCtx.newPage();
    await bp.goto(LISTING_URL);

    // Compliance-visible before submitting: the AI is disclosed on the form.
    await expect(bp.getByText(/clearly\s+labelled AI assistant/)).toBeVisible();

    await bp.getByLabel("Name").fill(buyerName);
    await bp.getByLabel("Email").fill("e2e-money-shot-buyer@example.com");
    await bp.getByLabel("Message (optional)").fill("Is it still available? Keen to view this week.");
    await bp.getByRole("button", { name: "Send enquiry" }).click();

    // Buyer-side confirmation (runbook step 1→2).
    await expect(
      bp.getByRole("heading", { name: "Enquiry sent — and already acknowledged." }),
    ).toBeVisible({ timeout: 20_000 });

    // ─── DB truth: lead exists, funnel-entry logged, ack pipeline engaged ──
    const enquiryId = await poll(async () => {
      const { data } = await svc
        .from("enquiries")
        .select("id")
        .eq("buyer_name", buyerName)
        .maybeSingle<{ id: string }>();
      return data?.id ?? null;
    }, "the enquiry row");

    const preApprove = await eventTimes(svc, enquiryId);
    expect(preApprove.has("enquiry_received"), "enquiry_received must be auto-logged").toBe(true);

    // First-touch evidence, in order of strength: the ack_sent event (email
    // provider configured), the AI lane's ai_first_response_sent (fires even
    // on its templated SAFE PATH when no model is reachable — by design), or
    // the parked email_outbox row (offline ack). Either way the automated
    // first touch engaged before any human acted.
    const ackAt = await poll(async () => {
      const events = await eventTimes(svc, enquiryId);
      const sentAt = events.get("ack_sent") ?? events.get("ai_first_response_sent");
      if (sentAt !== undefined) return sentAt;
      const { data } = await svc
        .from("email_outbox")
        .select("created_at")
        .eq("enquiry_id", enquiryId)
        .maybeSingle<{ created_at: string }>();
      return data ? new Date(data.created_at).getTime() : null;
    }, "first-touch evidence (ack/first-response event or outbox row)");

    // The AI's draft — deterministic stand-in for generateDraft (see header).
    const { error: draftErr } = await svc
      .from("ai_drafts")
      .insert({ enquiry_id: enquiryId, draft_text: DRAFT_TEXT, status: "pending" });
    expect(draftErr).toBeNull();

    // Buyer-side AI label (runbook step 3's disclosure) on the thread page.
    await bp.goto(`/thread/${enquiryId}`);
    await expect(bp.getByText("AI assistant", { exact: true })).toBeVisible();
    await buyerCtx.close();

    // ─── Dealer context: inbox → lead → edit → approve ────────────────────
    const dealerCtx = await browser.newContext();
    const dp = await dealerCtx.newPage();
    await dp.goto("/sign-in");
    await dp.getByLabel("Email", { exact: true }).fill(DEALER_EMAIL!);
    await dp.getByLabel("Password", { exact: true }).fill(DEALER_PASSWORD!);
    await dp.getByRole("button", { name: "Sign in" }).click();
    // Post-PROMPT-10: sign-in is role-aware — a dealer lands on the dealer home
    // (/dealer), not the marketing page. The inbox is one hop from there.
    await dp.waitForURL((u) => u.pathname === "/dealer", { timeout: 30_000 });

    await dp.goto("/dealer/leads");
    const row = dp.getByRole("row").filter({ hasText: buyerName });
    await expect(row, "the fresh enquiry appears in the dealer inbox").toBeVisible();
    await row.getByRole("link", { name: "Open" }).click();
    await expect(dp).toHaveURL(new RegExp(`/dealer/leads/${enquiryId}`));

    // Timeline shows the funnel-entry event; the draft is gated, NOT sent.
    await expect(dp.getByText("enquiry_received")).toBeVisible();
    await expect(dp.getByText("draft, not sent")).toBeVisible();

    const textarea = dp.getByLabel("AI-drafted reply — edit before sending");
    await expect(textarea).toHaveValue(DRAFT_TEXT);
    await textarea.fill(`${DRAFT_TEXT}\n\n${EDIT_LINE}`); // runbook step 4: edit one line
    await dp.getByRole("button", { name: "Approve & send" }).click(); // step 5
    // Success shows either as the form's transient note or — when the server
    // action's revalidate wins the race — as the refreshed "sent" state.
    await expect(
      dp.getByText(/Reply approved and sent|reply for this lead has been sent/).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Reload: the pending draft is gone; the timeline carries the approval.
    await dp.reload();
    await expect(dp.getByText("the reply for this lead has been sent")).toBeVisible();
    await expect(dp.getByText("draft_approved")).toBeVisible();
    await expect(dp.getByText("reply_sent")).toBeVisible();
    await dealerCtx.close();

    // ─── DB truth: state machine + ordering ───────────────────────────────
    // Scope to OUR draft: the failed AI lane parks its own fallback row
    // (status generation_failed) on the same enquiry.
    const { data: draft } = await svc
      .from("ai_drafts")
      .select("status, approved_by, approved_at, sent_at, edited_text")
      .eq("enquiry_id", enquiryId)
      .eq("draft_text", DRAFT_TEXT)
      .single<{
        status: string;
        approved_by: string | null;
        approved_at: string | null;
        sent_at: string | null;
        edited_text: string | null;
      }>();
    expect(draft?.status).toBe("sent");
    expect(draft?.approved_by).toBeTruthy();
    expect(draft?.approved_at).toBeTruthy();
    expect(draft?.sent_at).toBeTruthy();
    expect(draft?.edited_text ?? "").toContain(EDIT_LINE);

    const events = await eventTimes(svc, enquiryId);
    const received = events.get("enquiry_received")!;
    const approved = events.get("draft_approved")!;
    const replied = events.get("reply_sent")!;
    expect(approved, "draft_approved must exist").toBeTruthy();
    expect(replied, "reply_sent must exist").toBeTruthy();
    // Order where it matters: funnel entry → ack → approval → reply.
    expect(received).toBeLessThanOrEqual(ackAt);
    expect(ackAt, "the ack must pre-date any human approval").toBeLessThanOrEqual(approved);
    expect(approved).toBeLessThanOrEqual(replied);

    const { data: enquiry } = await svc
      .from("enquiries")
      .select("status")
      .eq("id", enquiryId)
      .single<{ status: string }>();
    expect(enquiry?.status).toBe("contacted");
  });
});
