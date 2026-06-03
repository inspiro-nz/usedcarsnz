import { NextResponse } from "next/server";

export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  if (!siteKey) {
    return NextResponse.json(
      { error: "Turnstile site key is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.json({ siteKey });
}
