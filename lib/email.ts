import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * Transactional email via Resend. Without RESEND_API_KEY (local dev) it logs
 * instead of sending, so the lead engine works end-to-end offline.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /**
   * Overrides the default From. Used by the inbound-email lane to send the ack
   * as "{Dealer} via UsedCarsNZ <no-reply@usedcarsnz.co.nz>" (§5.3). Must stay
   * on the usedcarsnz.co.nz sending domain — Resend/DKIM only sign that domain.
   * Omitted => the platform default below, unchanged for every existing caller.
   */
  from?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    console.info(`[email:skipped no RESEND_API_KEY] to=${input.to} subject="${input.subject}"`);
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from ?? "UsedCarsNZ <no-reply@usedcarsnz.co.nz>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    console.error(`[email:failed] ${res.status} ${error}`);
    return { sent: false, error: `${res.status} ${error}` };
  }
  return { sent: true };
}
