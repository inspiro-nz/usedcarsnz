import "server-only";

/**
 * Stub for the bounded AI qualification layer (strategy §7). This session
 * (enquiry-intake) only wires the ctx.waitUntil hook that calls this — it
 * must compile and log, nothing more. A later session (ai-service) replaces
 * this with the real Lane 1 qualification turn; the buyer-facing SLA never
 * depends on it, since the templated ack has already been sent synchronously
 * by POST /api/enquiries before this runs.
 */
export async function triggerQualification(enquiryId: string): Promise<void> {
  console.log(`[ai:trigger] stub — would start AI qualification for enquiry ${enquiryId}`);
}
