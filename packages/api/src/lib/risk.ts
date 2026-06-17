/**
 * Open approximation of Benjamin Cowen's "risk metric" (Into The Cryptoverse).
 *
 * Canonical community formula (BitcoinRaven/Bitcoin-Risk-Metric-V2):
 *
 *   sma    = rollingMean(price, window)                       // window = 365
 *   preavg = (ln(price) - ln(sma)) * (dayIndex ** exponent)   // exponent = 0.395
 *   risk   = (preavg - min(preavg)) / (max(preavg) - min(preavg))   // -> 0..1
 *
 * `dayIndex` is 1-based from the start of the full history; the `^0.395` term is the
 * "diminishing returns" dampening that makes cycle tops land at comparable risk.
 * Normalization uses GLOBAL min/max (the published retro look), not causal cummin/cummax.
 *
 * This is a transparent approximation, NOT Cowen's proprietary model.
 */

export interface PricePoint {
  /** ISO date string, YYYY-MM-DD */
  date: string;
  price: number;
}

export interface RiskPoint {
  date: string;
  price: number;
  /** 0..1 risk value */
  risk: number;
}

export interface RiskOptions {
  /** SMA window in days. Default 365. */
  window?: number;
  /** Diminishing-returns dampening exponent. Default 0.395. */
  exponent?: number;
}

/**
 * Simple moving average. Returns an array aligned to `values`; entries before a full
 * window is available are `null`.
 */
export function sma(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= window) sum -= values[i - window]!;
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/**
 * Compute the risk metric for a price series. Input is sorted ascending by date.
 * Points before the SMA window is available (and any with non-positive price) are
 * dropped from the output, since they have no defined risk.
 */
export function computeRisk(points: PricePoint[], options: RiskOptions = {}): RiskPoint[] {
  const window = options.window ?? 365;
  const exponent = options.exponent ?? 0.395;

  if (points.length === 0) return [];

  // Defensive: ensure ascending by date.
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const prices = sorted.map((p) => p.price);
  const movingAvg = sma(prices, window);

  // preavg per index (null where undefined), plus running global min/max.
  const preavg: (number | null)[] = Array.from({ length: sorted.length }, () => null);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < sorted.length; i++) {
    const price = prices[i]!;
    const ma = movingAvg[i];
    if (ma == null || price <= 0 || ma <= 0) continue;
    // dayIndex is 1-based from the start of the full history.
    const value = (Math.log(price) - Math.log(ma)) * Math.pow(i + 1, exponent);
    preavg[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const range = max - min;
  const result: RiskPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const value = preavg[i];
    if (value == null) continue;
    const risk = range > 0 ? (value - min) / range : 0;
    result.push({ date: sorted[i]!.date, price: prices[i]!, risk });
  }
  return result;
}
