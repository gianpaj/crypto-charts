/**
 * Build-time data generation for the static site.
 *
 * Fetches full BTC/USD daily history from Bitstamp, computes the risk metric, and writes
 * a static JSON to public/data/btc-risk.json. Run before `next build` (locally and in CI).
 * This is what makes the dashboard work on GitHub Pages with no server.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDailyHistory } from "@crypto-charts/api/lib/bitstamp";
import { computeRisk } from "@crypto-charts/api/lib/risk";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "public", "data", "btc-risk.json");

const history = await fetchDailyHistory();
const points = computeRisk(history).map((p) => ({
  date: p.date,
  price: Math.round(p.price * 100) / 100,
  risk: Math.round(p.risk * 10000) / 10000,
}));

const payload = {
  asset: "BTC",
  source: "Bitstamp (BTC/USD daily)",
  generatedAt: new Date().toISOString(),
  points,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload));

const first = points.at(0);
const last = points.at(-1);
console.log(
  `Wrote ${points.length} points (${first?.date} → ${last?.date}, latest risk ${last?.risk}) to ${outPath}`,
);
