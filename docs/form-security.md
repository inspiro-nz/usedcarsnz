# Form Security Implementation

This document describes the security measures implemented for the UsedCarsNZ Founding Dealer Program signup form.

## Overview

The form is protected with multiple layers of security to prevent abuse, spam, and automated attacks:

1. **Cloudflare Turnstile** - CAPTCHA verification
2. **Honeypot Fields** - Bot trap
3. **Server-side Validation** - Zod schema validation
4. **Rate Limiting** - IP-based request throttling
5. **Input Sanitization** - XSS prevention
6. **Type Safety** - Full TypeScript implementation

## Environment Variables

### Required (Production)

```bash
# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key

# Email configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL="UsedCarsNZ <no-reply@usedcarsnz.co.nz>"
LEAD_EMAIL=your-email@example.com
```

### Getting Turnstile Keys

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Turnstile** > **Overview**
3. Create a new site:
   - **Name**: `usedcarsnz.co.nz`
   - **Mode**: Managed
   - **Bot Score Threshold**: Normal (0.3)
4. Copy the **Site Key** and **Secret Key**

## Security Features

### 1. Cloudflare Turnstile

**Purpose**: Verify that requests come from real humans, not bots.

**How it works**:
- Client-side: Loads Turnstile widget from Cloudflare CDN
- User completes CAPTCHA challenge
- Browser receives a verification token
- Token is submitted with form to server
- Server verifies token with Cloudflare API

**Implementation**:
- Widget rendered in `components/PilotForm.tsx`
- Verification happens in `app/api/lead/route.ts`
- Token is required for form submission
- Invalid tokens return HTTP 400

**Files**:
- `components/PilotForm.tsx` - Client-side widget rendering
- `app/api/lead/route.ts` - Server-side token verification

### 2. Honeypot Protection

**Purpose**: Catch bots that fill out all form fields.

**How it works**:
- Hidden `website` field is invisible to real users
- CSS and HTML attributes hide it from browsers
- Bots typically fill all fields
- If honeypot field has any value, submission is silently rejected
- Server logs the violation for monitoring

**Implementation**:
```tsx
// Hidden from users via CSS and attributes
<input
  type="text"
  name="website"
  style={{ display: 'none' }}
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
/>
```

**Files**:
- `components/PilotForm.tsx` - Honeypot field definition
- `app/api/lead/route.ts` - Honeypot validation

### 3. Server-side Validation (Zod)

**Purpose**: Ensure data integrity and type safety.

**How it works**:
- All form inputs validated against strict schema
- Each field has min/max length constraints
- Email validated with regex
- Phone validated with regex
- Enquiry volume restricted to known values
- Turnstile token required

**Schema**:
```typescript
const formSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  dealership: z.string().min(2).max(100).trim(),
  email: z.string().email(),
  phone: z.string().regex(/^[\d\s()+-]{7,}$/).optional().or(z.literal('')),
  enquiries: z.enum(['Under 20', '20–50', '50–100', '100–200', '200+']),
  token: z.string().min(1),
  website: z.string().optional(),
});
```

**Error Response**:
- Returns HTTP 400 with descriptive error messages
- Error messages are user-friendly (no technical details)
- Field-specific validation errors listed

**Files**:
- `app/api/lead/route.ts` - Zod schema and validation logic

### 4. Rate Limiting

**Purpose**: Prevent brute force attacks and spam floods.

**How it works**:
- Maximum 5 submissions per IP per hour
- IP extracted from Cloudflare headers
- Timestamps tracked per IP
- Old timestamps cleaned from store
- Exceeding limit returns HTTP 429 (Too Many Requests)

**Configuration**:
```typescript
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5; // Per IP per hour
```

**Response on Rate Limit Exceeded**:
```json
{
  "error": "Too many requests. Please try again later.",
  "status": 429,
  "headers": {
    "Retry-After": "3600"
  }
}
```

**IP Extraction Strategy**:
- Tries multiple headers in order of preference:
  1. `CF-Connecting-IP` (set by Cloudflare)
  2. `X-Forwarded-For` (proxy header)
  3. `X-Real-IP` (nginx/reverse proxy)
  4. Falls back to `127.0.0.1` if none found

**Cloudflare Pages Limitation**:
- Current implementation uses in-memory Map per function invocation
- Works for single-region deployments
- For multi-region Cloudflare deployment, upgrade to Cloudflare KV

**Files**:
- `app/api/lead/route.ts` - Rate limiting implementation

### 5. Input Sanitization

**Purpose**: Prevent HTML injection and XSS attacks in email content.

**How it works**:
- All string inputs sanitized before email content
- HTML special characters escaped:
  - `&` → `&amp;`
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `"` → `&quot;`
  - `'` → `&#x27;`

**Implementation**:
```typescript
function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

**Files**:
- `app/api/lead/route.ts` - Sanitization function and usage

## Deployment

### Local Development

1. Add environment variables to `.env.local`:
```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=0x4AAF12345678901234567890
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="UsedCarsNZ <no-reply@usedcarsnz.co.nz>"
LEAD_EMAIL=leads@usedcarsnz.co.nz
```

2. Start development server:
```bash
npm install
npm run dev
```

3. Open http://localhost:3000 and test the form

### Cloudflare Pages Deployment

1. Add secrets to Cloudflare:
   - Go to **Workers & Pages** > **usedcarsnz** > **Settings** > **Environment Variables**
   - Add all required environment variables with `Encrypted` type for secrets

2. Add `NEXT_PUBLIC_*` variables as regular environment variables:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public, can be plain environment variable)

3. Deploy:
```bash
npm run build
npm install -g @cloudflare/wrangler
wrangler pages deploy
```

4. Verify Turnstile in production:
   - Form should show Turnstile widget on page load
   - Verify token submission on form submit
   - Check logs in Cloudflare Workers dashboard

## Monitoring & Logging

### Server Logs

Form submissions log:
- Honeypot triggers: `console.warn('Honeypot triggered from IP:', clientIP)`
- Invalid Turnstile tokens: `console.warn('Invalid Turnstile token from IP:', clientIP)`
- Email errors: `console.error('Resend email error:', error)`

### Email Metadata

Each submission includes:
- Client IP address
- ISO timestamp
- All form fields (sanitized)

### Cloudflare Dashboard

Monitor in Cloudflare:
- **Analytics** > **Turnstile** to see verification success/failure rates
- **Workers** > **Real-time Logs** to see function execution errors
- **Pages** > **Analytics** for page traffic and performance

## Upgrade Guide: Adding Cloudflare KV for Rate Limiting

For production deployments with multiple regions or high traffic, upgrade to Cloudflare KV for distributed rate limiting.

### 1. Enable KV Binding

Add to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your_kv_namespace_id"
preview_id = "your_preview_kv_namespace_id"
```

### 2. Update Rate Limiting Code

Replace in-memory implementation in `app/api/lead/route.ts`:

```typescript
// Replace checkRateLimit function with:
async function checkRateLimitKV(
  ip: string,
  env: { RATE_LIMIT_KV: KVNamespace }
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate-limit:${ip}`;
  const data = await env.RATE_LIMIT_KV.get(key, 'json') as { count: number } | null;
  
  const count = (data?.count ?? 0) + 1;
  
  if (count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  // Set with 1 hour TTL
  await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count }), {
    expirationTtl: 3600,
  });
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - count };
}
```

### 3. Update POST Handler

```typescript
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Use KV instead of in-memory Map
  const env = process.env as unknown as { RATE_LIMIT_KV: KVNamespace };
  const rateLimit = await checkRateLimitKV(clientIP, env);
  
  // ... rest of handler
}
```

## Security Checklist

- [ ] Turnstile keys configured in Cloudflare
- [ ] Environment variables set in production
- [ ] Rate limiting thresholds reviewed
- [ ] Email recipients configured correctly
- [ ] Honeypot field hidden in CSS and HTML
- [ ] Form tested with invalid inputs
- [ ] Form tested with rapid submissions
- [ ] Turnstile widget appears on page load
- [ ] Success and error messages display correctly
- [ ] Email formatting looks good in client inbox
- [ ] Logs monitored for errors and abuse attempts
- [ ] HTTPS enabled (Cloudflare Pages default)

## Troubleshooting

### Turnstile widget not loading

1. Check `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and public
2. Check browser console for script load errors
3. Verify site key is correct in Cloudflare dashboard
4. Try clearing browser cache

### Form submissions rejected with "Security verification failed"

1. Verify `TURNSTILE_SECRET_KEY` is correct
2. Check Cloudflare Turnstile logs for token errors
3. Ensure token is being sent with form data
4. Try submitting from different browser/IP

### Rate limiting not working

1. Verify client IP extraction:
   - Add `console.log('Client IP:', clientIP)` to check detected IP
   - Behind proxy? May need header configuration
2. Check rate limit configuration values
3. Clear in-memory store (restart server)
4. For multi-instance, upgrade to Cloudflare KV

### Emails not being received

1. Verify `RESEND_API_KEY` is correct
2. Check `LEAD_EMAIL` and `RESEND_FROM_EMAIL`
3. Check Resend dashboard for delivery failures
4. Verify sender domain is authenticated in Resend

## References

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Zod Documentation](https://zod.dev/)
- [Resend Documentation](https://resend.com/docs)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Output Encoding](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
