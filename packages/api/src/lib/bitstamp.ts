/**
 * Bitstamp OHLC fetcher — free, keyless daily BTC/USD history back to 2011-08-25.
 *
 * Why Bitstamp: it needs no API key and is one of the oldest BTC/USD venues, so it gives
 * the longest no-auth daily history. (CoinGecko's free tier caps at 365 days; CryptoCompare/
 * CoinDesk now require a key; Binance BTCUSDT only starts 2017; Coinbase ~2015.)
 *
 * Docs: https://www.bitstamp.net/api/#tag/Market-info  (GET /ohlc/{pair}/)
 */

import type { PricePoint } from "./risk";

const OHLC_URL = "https://www.bitstamp.net/api/v2/ohlc/btcusd/";
const DAY_SECONDS = 86_400;
const MAX_LIMIT = 1000; // Bitstamp max points per request
const GENESIS = 1_314_230_400; // 2011-08-25, first BTC/USD daily candle on Bitstamp
const MAX_PAGES = 30; // safety cap (~30k days)

interface BitstampCandle {
  timestamp: string;
  close: string;
}

interface BitstampResponse {
  data?: {
    ohlc: BitstampCandle[];
  };
}

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Fetch the full available daily BTC/USD history, paginating forward from genesis.
 * Returns points ascending by date, deduped, with non-positive closes filtered out.
 */
export async function fetchDailyHistory(): Promise<PricePoint[]> {
  const byTime = new Map<number, number>(); // unix seconds -> close
  let start = GENESIS;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      step: String(DAY_SECONDS),
      limit: String(MAX_LIMIT),
      start: String(start),
    });

    const res = await fetch(`${OHLC_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Bitstamp HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as BitstampResponse;
    const batch = json.data?.ohlc ?? [];
    if (batch.length === 0) break;

    let latest = start;
    for (const candle of batch) {
      const time = Number(candle.timestamp);
      const close = Number(candle.close);
      if (Number.isFinite(time) && close > 0) byTime.set(time, close);
      if (time > latest) latest = time;
    }

    // Reached the present once a page comes back short.
    if (batch.length < MAX_LIMIT) break;
    start = latest + DAY_SECONDS;
  }

  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, close]) => ({ date: toIsoDate(time), price: close }));
}
