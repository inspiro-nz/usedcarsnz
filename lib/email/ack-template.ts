import { escapeHtml } from "@/lib/sanitize";

/**
 * The instant, templated acknowledgement (§7 compliance envelope). This is
 * NOT an AI-generated message — it is a static template so it can be sent
 * synchronously, deterministically, with no LLM in the path. It must contain
 * NOTHING vehicle-specific: only the acknowledgement, what happens next, the
 * dealer's name, and clear "AI assistant of {dealer}" labelling.
 */
export interface AckEmailInput {
  buyerName: string;
  dealerName: string | null;
  dealerLogoUrl: string | null;
  threadUrl: string;
}

export interface AckEmail {
  subject: string;
  text: string;
  html: string;
}

export function buildAckEmail(input: AckEmailInput): AckEmail {
  const dealer = input.dealerName ?? "the seller";
  const buyerName = escapeHtml(input.buyerName);
  const dealerEsc = escapeHtml(dealer);

  const subject = `We're onto it — ${dealer} has your enquiry`;

  const text = [
    `Kia ora ${input.buyerName},`,
    ``,
    `Thanks for your enquiry — it's been sent straight to ${dealer}, and a team member will follow up with you personally.`,
    ``,
    `You can follow the conversation here any time: ${input.threadUrl}`,
    ``,
    `This is an automated acknowledgement from the AI assistant of ${dealer}. A human will reply to anything about the vehicle itself.`,
  ].join("\n");

  const logo = input.dealerLogoUrl
    ? `<img src="${escapeHtml(input.dealerLogoUrl)}" alt="${dealerEsc}" style="max-height:40px;margin-bottom:16px;" />`
    : "";

  const html = `
<div style="font-family:system-ui,sans-serif;color:#0f172a;max-width:520px;margin:0 auto;">
  ${logo}
  <p style="margin:0 0 16px;">Kia ora ${buyerName},</p>
  <p style="margin:0 0 16px;">
    Thanks for your enquiry — it's been sent straight to <strong>${dealerEsc}</strong>,
    and a team member will follow up with you personally.
  </p>
  <p style="margin:0 0 24px;">
    <a href="${escapeHtml(input.threadUrl)}" style="color:#ea580c;font-weight:600;">
      Follow the conversation here any time
    </a>
  </p>
  <p style="margin:0;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
    This is an automated acknowledgement from the <strong>AI assistant of ${dealerEsc}</strong>.
    A human will reply to anything about the vehicle itself.
  </p>
</div>`.trim();

  return { subject, text, html };
}
