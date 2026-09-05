import "server-only";

import { supabaseService } from "@/lib/supabase/service";
import { buildAckEmail } from "@/lib/email/ack-template";
import { sendEmail } from "@/lib/email";
import { insertOutboxRow } from "@/lib/email/outbox";
import { emitLeadEvent } from "@/lib/leads/events";
import { triggerQualification } from "@/lib/ai/trigger";
import { getClientEnv } from "@/lib/env";

/**
 * The shared "first touch" for a freshly-created enquiry — the post-creation
 * TAIL that is identical across both intake lanes (strategy §7 compliance
 * envelope):
 *
 *   1. Send the TEMPLATED (no-LLM) acknowledgement to the buyer, or queue it in
 *      email_outbox if Resend is down — the buyer/SLA never depends on model
 *      latency or Resend uptime.
 *   2. On send, record the ai messages row + the ack_sent lead_event (with the
 *      server-measured enquiry_received -> ack_sent latency).
 *   3. Schedule AI qualification via the caller's waitUntil, AFTER the response.
 *
 * Extracted from POST /api/enquiries (which now calls this) so the inbound-email
 * lane (POST /api/inbound/email) reuses the exact same behaviour instead of
 * forking it. The two lanes differ only in how the enquiry ROW is created
 * (platform = insert-as-caller under RLS; email = service-role + alias routing);
 * everything from that point on is this function.
 */
export interface FirstTouchInput {
  enquiry: { id: string; created_at: string };
  buyer: { name: string; email: string };
  dealer: { name: string | null; email: string | null; logoUrl: string | null };
  /**
   * false => skip the ack entirely (inbound-email lane, dealer opted out via
   * dealers.email_ack_enabled). Qualification is still scheduled. Defaults to
   * true; the platform form always acks.
   */
  ackEnabled?: boolean;
  /**
   * From override for the ack. The email lane passes
   * "{Dealer} via UsedCarsNZ <no-reply@usedcarsnz.co.nz>"; the platform form
   * omits it (default sender). Reply-To is always the dealer.
   */
  ackFrom?: string;
  /** The ack_sent event's channel tag. Defaults to "email". */
  channel?: "email" | "sms";
  /** Schedules qualification to run after the response is returned (ctx.waitUntil). */
  waitUntil: (promise: Promise<unknown>) => void;
}

export async function runFirstTouch(input: FirstTouchInput): Promise<void> {
  const svc = supabaseService();
  const env = getClientEnv();
  const channel = input.channel ?? "email";
  const threadUrl = `${env.NEXT_PUBLIC_SITE_URL}/thread/${input.enquiry.id}`;

  if (input.ackEnabled !== false) {
    const ack = buildAckEmail({
      buyerName: input.buyer.name,
      dealerName: input.dealer.name,
      dealerLogoUrl: input.dealer.logoUrl,
      threadUrl,
    });

    const sendResult = await sendEmail({
      to: input.buyer.email,
      subject: ack.subject,
      text: ack.text,
      html: ack.html,
      replyTo: input.dealer.email ?? undefined,
      ...(input.ackFrom ? { from: input.ackFrom } : {}),
    });

    if (sendResult.sent) {
      await svc.from("messages").insert({
        enquiry_id: input.enquiry.id,
        sender: "ai",
        body: ack.text,
      });
      const msSinceReceived = Date.now() - new Date(input.enquiry.created_at).getTime();
      await emitLeadEvent({
        leadId: input.enquiry.id,
        eventType: "ack_sent",
        actor: "ai",
        metadata: { channel, template: "first-touch-v1", ms_since_received: msSinceReceived },
      });
    } else {
      // Buyer still gets a success response — the SLA is about telling them
      // "we've got this", not about Resend's uptime. No ack_sent is emitted
      // until lib/email/outbox.ts's sweep actually sends it.
      await insertOutboxRow({
        enquiryId: input.enquiry.id,
        to: input.buyer.email,
        replyTo: input.dealer.email ?? undefined,
        subject: ack.subject,
        text: ack.text,
        html: ack.html,
        lastError: sendResult.error ?? "unknown error",
      });
    }
  }

  input.waitUntil(
    triggerQualification(input.enquiry.id).catch((err) => {
      console.error(`[ai:trigger] triggerQualification failed for ${input.enquiry.id}:`, err);
    }),
  );
}
