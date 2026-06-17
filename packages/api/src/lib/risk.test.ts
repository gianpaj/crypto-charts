import { describe, expect, it } from "vitest";

import { computeRisk, sma, type PricePoint } from "./risk";

function isoDate(dayOffset: number): string {
  // Deterministic date sequence starting 2013-01-01.
  const base = Date.UTC(2013, 0, 1);
  return new Date(base + dayOffset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Build a synthetic BTC-like series with two clear cycle tops and bottoms so we can
 * assert that risk peaks near tops and troughs near bottoms.
 */
function syntheticSeries(): PricePoint[] {
  const points: PricePoint[] = [];
  const cycleLen = 730; // ~2 years
  for (let i = 0; i < 2920; i++) {
    // Exponential uptrend + cyclical swing => tops near phase peak, bottoms near trough.
    const trend = Math.exp(i / 900);
    const swing = 1 + 0.8 * Math.sin((2 * Math.PI * i) / cycleLen - Math.PI / 2);
    points.push({ date: isoDate(i), price: 100 * trend * swing });
  }
  return points;
}

describe("sma", () => {
  it("is null until the window is filled, then averages correctly", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("computeRisk", () => {
  it("returns empty for empty input", () => {
    expect(computeRisk([])).toEqual([]);
  });

  it("drops the leading window (no SMA) and outputs the rest", () => {
    const series = syntheticSeries();
    const result = computeRisk(series, { window: 365 });
    expect(result.length).toBe(series.length - 364);
  });

  it("produces risk values strictly within [0, 1]", () => {
    const result = computeRisk(syntheticSeries());
    for (const point of result) {
      expect(point.risk).toBeGreaterThanOrEqual(0);
      expect(point.risk).toBeLessThanOrEqual(1);
    }
  });

  it("assigns high risk near cycle tops and low risk near cycle bottoms", () => {
    const series = syntheticSeries();
    const result = computeRisk(series);
    const byDate = new Map(result.map((p) => [p.date, p.risk]));

    // swing = 1 + 0.8*sin(2π·i/730 − π/2): troughs at i = 730k, peaks at i = 365 + 730k.
    // Pick a peak and a trough well past the 365-day SMA warmup.
    const topRisk = byDate.get(isoDate(1095))!; // peak (365 + 730)
    const bottomRisk = byDate.get(isoDate(1460))!; // trough (730·2)

    expect(topRisk).toBeDefined();
    expect(bottomRisk).toBeDefined();
    expect(topRisk).toBeGreaterThan(0.6);
    expect(topRisk - bottomRisk).toBeGreaterThan(0.2);
  });

  it("respects a smaller window option", () => {
    const series = syntheticSeries();
    const result = computeRisk(series, { window: 50 });
    expect(result.length).toBe(series.length - 49);
  });
});
