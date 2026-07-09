import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ TURNSTILE_SECRET_KEY: "test-secret" }),
}));

import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when Cloudflare siteverify reports success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true }))),
    );
    await expect(verifyTurnstile("good-token")).resolves.toBe(true);
  });

  it("returns false when Cloudflare siteverify reports failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false, error_codes: ["invalid-input-response"] }))),
    );
    await expect(verifyTurnstile("bad-token")).resolves.toBe(false);
  });

  it("returns false for an empty token without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyTurnstile("")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the network call throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(verifyTurnstile("token")).resolves.toBe(false);
  });
});
