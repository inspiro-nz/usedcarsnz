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
}): Promise<{ sent: boolean }> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    console.info(`[email:skipped no RESEND_API_KEY] to=${input.to} subject="${input.subject}"`);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "UsedCarsNZ <no-reply@usedcarsnz.co.nz>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!res.ok) console.error(`[email:failed] ${res.status} ${await res.text()}`);
  return { sent: res.ok };
}
