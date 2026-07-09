import "server-only";

import { supabaseService } from "@/lib/supabase/service";
import { emitLeadEvent } from "@/lib/leads/events";

/**
 * Resend-failure safe path for the templated enquiry ack (§ compliance
 * envelope, migration 20260709090000_email_outbox.sql).
 *
 * POST /api/enquiries calls insertOutboxRow() the moment a send attempt
 * fails, so the buyer still gets a success response and the ack is never
 * silently dropped. sweepOutbox() is the retry: it is Cron-Trigger-ready
 * (wiring the actual cron trigger is a later session, per the brief) but can
 * already be invoked directly (e.g. from a script, or a future route) to
 * drain the queue.
 */

export interface OutboxEmail {
  enquiryId: string | null;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}

export async function insertOutboxRow(input: OutboxEmail & { lastError: string }): Promise<void> {
  const svc = supabaseService();
  const { error } = await svc.from("email_outbox").insert({
    enquiry_id: input.enquiryId,
    to: input.to,
    reply_to: input.replyTo ?? null,
    subject: input.subject,
    body_text: input.text,
    body_html: input.html ?? null,
    attempts: 1,
    last_error: input.lastError,
  });
  if (error) throw new Error(`email_outbox insert: ${error.message}`);
}

interface OutboxRow {
  id: string;
  enquiry_id: string | null;
  to: string;
  reply_to: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  attempts: number;
  created_at: string;
}

export interface SweepResult {
  attempted: number;
  sent: number;
  failed: number;
}

/**
 * Retries every unsent row. On success: marks sent_at, and — only now, since
 * this is the first time the ack actually reached the buyer — emits
 * ack_sent with ms_since_received measured from the ORIGINAL enquiry receipt,
 * not from the retry. On failure: bumps attempts/last_error and leaves the
 * row for the next sweep.
 */
export async function sweepOutbox(limit = 50): Promise<SweepResult> {
  const svc = supabaseService();
  const { data, error } = await svc
    .from("email_outbox")
    .select("*")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`email_outbox sweep read: ${error.message}`);

  const rows = (data ?? []) as OutboxRow[];
  const result: SweepResult = { attempted: rows.length, sent: 0, failed: 0 };

  for (const row of rows) {
    const { sendEmail } = await import("@/lib/email");
    const res = await sendEmail({
      to: row.to,
      subject: row.subject,
      text: row.body_text,
      html: row.body_html ?? undefined,
      replyTo: row.reply_to ?? undefined,
    });

    if (res.sent) {
      const now = new Date().toISOString();
      await svc.from("email_outbox").update({ sent_at: now }).eq("id", row.id);
      result.sent++;

      if (row.enquiry_id) {
        const { data: enquiry } = await svc
          .from("enquiries")
          .select("created_at")
          .eq("id", row.enquiry_id)
          .single<{ created_at: string }>();
        const msSinceReceived = enquiry
          ? Date.now() - new Date(enquiry.created_at).getTime()
          : null;
        await svc.from("messages").insert({
          enquiry_id: row.enquiry_id,
          sender: "ai",
          body: row.body_text,
        });
        await emitLeadEvent({
          leadId: row.enquiry_id,
          eventType: "ack_sent",
          actor: "ai",
          metadata: {
            channel: "email",
            template: "first-touch-v1",
            ...(msSinceReceived != null ? { ms_since_received: msSinceReceived } : {}),
            via_outbox_retry: true,
          },
        });
      }
    } else {
      await svc
        .from("email_outbox")
        .update({ attempts: row.attempts + 1, last_error: res.error ?? "unknown error" })
        .eq("id", row.id);
      result.failed++;
    }
  }

  return result;
}
