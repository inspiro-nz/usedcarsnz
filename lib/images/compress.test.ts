import { describe, it, expect } from "vitest";
import { fitWithinLongEdge, nextQuality, DEFAULTS } from "./compress";

describe("fitWithinLongEdge", () => {
  it("does not upscale images already within the long edge", () => {
    expect(fitWithinLongEdge(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
  });

  it("scales a landscape image so the width becomes the long edge", () => {
    expect(fitWithinLongEdge(3200, 2000, 1600)).toEqual({ width: 1600, height: 1000 });
  });

  it("scales a portrait image so the height becomes the long edge", () => {
    expect(fitWithinLongEdge(2000, 4000, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it("preserves aspect ratio within a rounding pixel", () => {
    const { width, height } = fitWithinLongEdge(4000, 3000, 1600);
    expect(width).toBe(1600);
    expect(Math.abs(width / height - 4000 / 3000)).toBeLessThan(0.01);
  });

  it("never returns a zero dimension for tiny images", () => {
    const { width, height } = fitWithinLongEdge(1, 3000, 1600);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBe(1600);
  });

  it("handles a zero-size input without dividing by zero", () => {
    expect(fitWithinLongEdge(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("nextQuality", () => {
  it("keeps quality unchanged when already under target", () => {
    expect(nextQuality(0.8, 100_000, DEFAULTS.targetBytes, 0.5)).toBe(0.8);
  });

  it("lowers quality when over target", () => {
    const q = nextQuality(0.8, 400_000, 200_000, 0.5);
    expect(q).toBeLessThan(0.8);
    expect(q).toBeGreaterThanOrEqual(0.5);
  });

  it("never drops below the quality floor even when way over target", () => {
    expect(nextQuality(0.8, 10_000_000, 200_000, 0.5)).toBe(0.5);
  });

  it("takes at most one proportional step down (clamped to 0.6x)", () => {
    // ratio would be 0.1, but a single step is clamped to 0.6x of current.
    expect(nextQuality(0.8, 2_000_000, 200_000, 0.1)).toBeCloseTo(0.48, 3);
  });
});
