import { describe, it, expect, afterEach } from "vitest";
import { verifyCronRequest } from "./auth";

function reqWith(auth?: string): Request {
  return new Request("https://app/api/cron/x", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("verifyCronRequest", () => {
  it("fails CLOSED with 503 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronRequest(reqWith("Bearer anything"))).toEqual({
      ok: false,
      status: 503,
      error: "CRON_SECRET not configured",
    });
  });

  it("rejects a missing Authorization header with 401", () => {
    process.env.CRON_SECRET = "s3cret";
    const r = verifyCronRequest(reqWith(undefined));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects a wrong bearer token with 401", () => {
    process.env.CRON_SECRET = "s3cret";
    const r = verifyCronRequest(reqWith("Bearer wrong"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects a non-Bearer scheme with 401", () => {
    process.env.CRON_SECRET = "s3cret";
    const r = verifyCronRequest(reqWith("Basic s3cret"));
    expect(r.ok).toBe(false);
  });

  it("accepts the correct bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(verifyCronRequest(reqWith("Bearer s3cret"))).toEqual({ ok: true });
  });
});
