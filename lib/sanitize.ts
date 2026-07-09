/**
 * HTML-escapes untrusted buyer input before it's interpolated into an email's
 * HTML body. Mirrors the escaping already shipped in the frozen
 * app/api/lead/route.ts's local sanitizeHtml — pulled out to a shared module
 * so POST /api/enquiries doesn't reimplement it, without editing the frozen
 * route itself.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
