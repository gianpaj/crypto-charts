/**
 * Cached BTC risk series. Wires Bitstamp fetch -> risk computation, with a 24h in-memory
 * cache and in-flight dedup so concurrent requests share one fetch.
 */

import { fetchDailyHistory } from "./bitstamp";
import { computeRisk, type RiskPoint } from "./risk";

const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { data: RiskPoint[]; ts: number } | null = null;
let inFlight: Promise<RiskPoint[]> | null = null;

async function loadBtcRisk(): Promise<RiskPoint[]> {
  const history = await fetchDailyHistory();
  return computeRisk(history);
}

export async function getBtcRisk(): Promise<RiskPoint[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = loadBtcRisk()
    .then((data) => {
      cache = { data, ts: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
