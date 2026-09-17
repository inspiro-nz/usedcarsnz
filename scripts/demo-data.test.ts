import { describe, it, expect } from "vitest";
import { checkDemoTarget, du } from "./demo-data";

const LOCAL = "http://127.0.0.1:54321";
const PROD = "https://geappcqiihbgihcsitkj.supabase.co";
const KEY = "sb_secret_x";

describe("checkDemoTarget — the production safety guard", () => {
  it("REFUSES the known production project URL, even with appEnv=demo", () => {
    const r = checkDemoTarget({ url: PROD, appEnv: "demo", secretKey: KEY });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: expect.stringContaining("PRODUCTION") });
  });

  it("REFUSES appEnv=production", () => {
    expect(checkDemoTarget({ url: LOCAL, appEnv: "production", secretKey: KEY }).ok).toBe(false);
  });

  it("REFUSES an unrecognised appEnv (e.g. dev, empty)", () => {
    expect(checkDemoTarget({ url: LOCAL, appEnv: "dev", secretKey: KEY }).ok).toBe(false);
    expect(checkDemoTarget({ url: LOCAL, appEnv: "", secretKey: KEY }).ok).toBe(false);
  });

  it("REFUSES appEnv=local paired with a non-local URL", () => {
    const r = checkDemoTarget({ url: "https://some-remote.supabase.co", appEnv: "local", secretKey: KEY });
    expect(r.ok).toBe(false);
  });

  it("REFUSES when the URL or secret key is missing", () => {
    expect(checkDemoTarget({ url: "", appEnv: "local", secretKey: KEY }).ok).toBe(false);
    expect(checkDemoTarget({ url: LOCAL, appEnv: "local", secretKey: "" }).ok).toBe(false);
  });

  it("ACCEPTS a local stack, and a demo stack on a non-prod host", () => {
    expect(checkDemoTarget({ url: LOCAL, appEnv: "local", secretKey: KEY }).ok).toBe(true);
    expect(checkDemoTarget({ url: "https://usedcarsnz-demo.supabase.co", appEnv: "demo", secretKey: KEY }).ok).toBe(true);
  });
});

describe("du — deterministic demo UUIDs", () => {
  it("is stable across calls (idempotent seeding depends on this)", () => {
    expect(du("dealer:1")).toBe(du("dealer:1"));
  });
  it("is distinct per key and shaped like a UUID", () => {
    expect(du("a")).not.toBe(du("b"));
    expect(du("dealer:1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
