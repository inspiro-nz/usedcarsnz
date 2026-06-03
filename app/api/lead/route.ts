import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const enquiryOptions = ['Under 20', '20–50', '50–100', '100–200', '200+'] as const;

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  dealership: z.string().min(2, 'Dealership name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[\d\s()+-]{7,}$/, 'Phone number must be valid').optional().or(z.literal('')),
  enquiries: z.enum(enquiryOptions, { message: 'Please select a valid enquiry volume' }),
  token: z.string().min(1, 'Security verification failed'),
  website: z.string().optional(), // Honeypot field
});

type FormData = z.infer<typeof formSchema>;

// Simple in-memory rate limiting — resets on cold start.
// Upgrade to Cloudflare KV for distributed protection (see docs/form-security.md).
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5;

/**
 * Extract client IP from request headers.
 * Tries multiple headers to support various proxy setups.
 */
function getClientIP(request: NextRequest): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');

  return cfConnectingIp || xForwardedFor?.split(',')[0] || xRealIp || '127.0.0.1';
}

/**
 * Check if IP has exceeded rate limit.
 * Removes old timestamps outside the window before checking.
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];

  // Remove old timestamps outside the window
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  rateLimitStore.set(ip, validTimestamps);

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - validTimestamps.length };
}

/**
 * Verify Turnstile CAPTCHA token with Cloudflare.
 * This prevents automated bot submissions.
 */
async function verifyTurnstile(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = (await response.json()) as { success: boolean; error_codes?: string[] };
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

/**
 * Sanitize string input to prevent HTML injection in emails.
 * Escapes HTML special characters.
 */
function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export async function POST(request: NextRequest) {
  // 1. Rate limiting check
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  // 2. Verify environment variables
  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 500 }
    );
  }

  const toEmail = process.env.LEAD_EMAIL ?? 'inspiroanalytics@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'UsedCarsNZ <no-reply@usedcarsnz.co.nz>';

  // 3. Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request format.' },
      { status: 400 }
    );
  }

  // 4. Honeypot check - reject if website field is populated
  const honeypot = (body as Record<string, unknown>).website;
  if (honeypot && String(honeypot).trim().length > 0) {
    // Silently accept to not alert bots they've been caught
    console.warn('Honeypot triggered from IP:', clientIP);
    return NextResponse.json({ status: 'success' });
  }

  // 5. Validate input with Zod
  const parseResult = formSchema.safeParse(body);

  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const internalFields = new Set(['token', 'website']);
    const errorMessage = Object.entries(fieldErrors)
      .filter(([field]) => !internalFields.has(field))
      .map(([, errors]) => errors?.[0])
      .filter(Boolean)
      .join(' ')
      .substring(0, 200);

    return NextResponse.json(
      { error: errorMessage || 'Validation failed. Please check your details.' },
      { status: 400 }
    );
  }

  const data: FormData = parseResult.data;

  // 6. Verify Turnstile CAPTCHA token
  const turnstileValid = await verifyTurnstile(data.token);
  if (!turnstileValid) {
    console.warn('Invalid Turnstile token from IP:', clientIP);
    return NextResponse.json(
      { error: 'Security verification failed. Please try again.' },
      { status: 400 }
    );
  }

  // 7. Sanitize data for email content (prevent HTML injection)
  const sanitizedName = sanitizeHtml(data.name);
  const sanitizedDealership = sanitizeHtml(data.dealership);
  const sanitizedEmail = sanitizeHtml(data.email);
  const sanitizedPhone = data.phone ? sanitizeHtml(data.phone) : 'Not provided';
  const sanitizedEnquiries = sanitizeHtml(data.enquiries);

  // 8. Send email
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = `UsedCarsNZ Founding Dealer Program Lead: ${sanitizedName}`;
  const html = `
    <div style="font-family:system-ui, sans-serif; color:#111;">
      <h1 style="font-size:20px; margin-bottom:8px;">UsedCarsNZ Founding Dealer Program Lead</h1>
      <p style="margin:0 0 16px;">A new verified Founding Dealer Program registration has been submitted:</p>
      <ul style="padding-left:16px; margin:0; line-height:1.8;">
        <li><strong>Name:</strong> ${sanitizedName}</li>
        <li><strong>Dealership:</strong> ${sanitizedDealership}</li>
        <li><strong>Email:</strong> ${sanitizedEmail}</li>
        <li><strong>Phone:</strong> ${sanitizedPhone}</li>
        <li><strong>Monthly enquiries:</strong> ${sanitizedEnquiries}</li>
        <li><strong>Client IP:</strong> ${clientIP}</li>
        <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
      </ul>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: sanitizedEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error('Resend email error:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please try again later.' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { status: 'success' },
    { status: 200 }
  );
}
