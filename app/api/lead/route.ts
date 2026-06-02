import { Resend } from "resend";
import { NextResponse } from "next/server";

const enquiryOptions = ['Under 20', '20–50', '50–100', '100–200', '200+'] as const;

type EnquiryOption = (typeof enquiryOptions)[number];

function sanitize(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return phone.length >= 7;
}

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_EMAIL ?? 'inspiroanalytics@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'UsedCarsNZ <no-reply@usedcarsnz.co.nz>';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Resend API key. Please set RESEND_API_KEY.' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const name = sanitize((body as Record<string, unknown>).name);
  const dealership = sanitize((body as Record<string, unknown>).dealership);
  const email = sanitize((body as Record<string, unknown>).email);
  const phone = sanitize((body as Record<string, unknown>).phone);
  const enquiries = sanitize((body as Record<string, unknown>).enquiries) as EnquiryOption;

  const errors: string[] = [];

  if (!name) errors.push('Name is required.');
  if (!dealership) errors.push('Dealership is required.');
  if (!email) {
    errors.push('Email is required.');
  } else if (!isValidEmail(email)) {
    errors.push('Email must be valid.');
  }
  if (!phone) errors.push('Phone number is required.');
  else if (!isValidPhone(phone)) errors.push('Phone number looks too short.');
  if (!enquiries) errors.push('Monthly enquiries selection is required.');
  else if (!enquiryOptions.includes(enquiries)) {
    errors.push('Monthly enquiries value is invalid.');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const subject = `UsedCarsNZ Pilot Lead: ${name}`;
  const html = `
    <div style="font-family:system-ui, sans-serif; color:#111;">
      <h1 style="font-size:20px; margin-bottom:8px;">UsedCarsNZ Christchurch Pilot Lead</h1>
      <p style="margin:0 0 16px;">A new pilot registration has been submitted:</p>
      <ul style="padding-left:16px; margin:0;">
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Dealership:</strong> ${dealership}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>Monthly enquiries:</strong> ${enquiries}</li>
      </ul>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error('Resend email error', error);
    return NextResponse.json({ error: 'Failed to send lead email. Please try again later.' }, { status: 502 });
  }

  return NextResponse.json({ status: 'success' });
}
