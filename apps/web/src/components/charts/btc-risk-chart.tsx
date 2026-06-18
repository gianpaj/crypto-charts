"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PRICE_COLOR = "#4f9cf9"; // BTC Price (blue)
const RISK_COLOR = "#e8425b"; // BTC Risk (red)

// Prefixed when served under a GitHub Pages project path (e.g. /crypto-charts).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface RiskJson {
  generatedAt: string;
  points: { date: string; price: number; risk: number }[];
}

async function fetchRiskData(): Promise<RiskJson> {
  const res = await fetch(`${BASE_PATH}/data/btc-risk.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as RiskJson;
}

// BTC has the longest history / most cycles, so ITC assigns it max confidence.
const CONFIDENCE = 9;

interface ChartPoint {
  t: number; // epoch ms
  price: number;
  risk: number;
}

type Scale = "log" | "linear";

const RANGES = [
  { key: "all", label: "All", years: null },
  { key: "4y", label: "4Y", years: 4 },
  { key: "2y", label: "2Y", years: 2 },
  { key: "1y", label: "1Y", years: 1 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const PRICE_TICKS = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
const RISK_TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const RISK_TICKS_LOG = [0.01, 0.1, 1];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatAxisPrice(value: number): string {
  if (value < 1) return String(value);
  return compact.format(value);
}

function formatTooltipPrice(value: number): string {
  if (value >= 1) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${value.toPrecision(3)}`;
}

function formatYear(t: number): string {
  return String(new Date(t).getUTCFullYear());
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-md border border-white/15 bg-black/90 px-3 py-2 text-xs text-white shadow-lg">
      <div className="mb-1 font-medium text-white/70">
        {new Date(point.t).toISOString().slice(0, 10)}
      </div>
      <div className="tabular-nums" style={{ color: PRICE_COLOR }}>
        Price {formatTooltipPrice(point.price)}
      </div>
      <div className="tabular-nums" style={{ color: RISK_COLOR }}>
        Risk {point.risk.toFixed(3)}
      </div>
    </div>
  );
}

function ScaleToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Scale;
  onChange: (s: Scale) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
      <div className="flex overflow-hidden rounded border border-white/15 text-xs">
        {(["linear", "log"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 transition-colors ${
              value === s ? "bg-white/90 text-black" : "text-white/60 hover:bg-white/10"
            }`}
          >
            {s === "log" ? "Logarithmic" : "Linear"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BtcRiskChart() {
  const [range, setRange] = useState<RangeKey>("all");
  const [priceScale, setPriceScale] = useState<Scale>("log");
  const [metricScale, setMetricScale] = useState<Scale>("linear");
  const query = useQuery({ queryKey: ["btc-risk"], queryFn: fetchRiskData });

  const allData = useMemo<ChartPoint[]>(() => {
    if (!query.data) return [];
    return query.data.points.map((p) => ({
      t: Date.parse(`${p.date}T00:00:00Z`),
      price: p.price,
      risk: p.risk,
    }));
  }, [query.data]);

  const data = useMemo<ChartPoint[]>(() => {
    const years = RANGES.find((r) => r.key === range)?.years ?? null;
    if (years === null || allData.length === 0) return allData;
    const last = allData[allData.length - 1]!.t;
    const cutoff = last - years * 365.25 * 24 * 60 * 60 * 1000;
    return allData.filter((p) => p.t >= cutoff);
  }, [allData, range]);

  const priceDomain = useMemo<[number, number] | [number, string]>(() => {
    if (data.length === 0) return [1, 100000];
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const p of data) {
      if (p.price < lo) lo = p.price;
      if (p.price > hi) hi = p.price;
    }
    if (priceScale === "log") return [lo * 0.6, hi * 1.4];
    return [0, hi * 1.1];
  }, [data, priceScale]);

  const latest = allData[allData.length - 1];

  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">BTC (Bitcoin) Historical Risk Levels</h2>
          <p className="text-xs text-white/50">
            {latest
              ? `Latest Value: ${latest.risk.toFixed(3)} | Confidence: ${CONFIDENCE}`
              : `Confidence: ${CONFIDENCE}`}
          </p>
        </div>
        <div className="flex items-end gap-4">
          <ScaleToggle label="Price Scale" value={priceScale} onChange={setPriceScale} />
          <ScaleToggle label="Metric Scale" value={metricScale} onChange={setMetricScale} />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-white/40">Range</span>
            <div className="flex overflow-hidden rounded border border-white/15 text-xs">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`px-2.5 py-1 transition-colors ${
                    range === r.key ? "bg-white/90 text-black" : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[520px] w-full rounded-md bg-black p-2">
        {query.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            Loading BTC history…
          </div>
        ) : query.isError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-400">
            Failed to load data: {query.error.message}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="#ffffff" strokeOpacity={0.07} vertical={false} />

              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatYear}
                minTickGap={40}
                tick={{ fontSize: 11, fill: "#ffffff", fillOpacity: 0.6 }}
                stroke="#ffffff"
                strokeOpacity={0.2}
              />
              <YAxis
                yAxisId="price"
                scale={priceScale}
                domain={priceDomain}
                ticks={priceScale === "log" ? PRICE_TICKS : undefined}
                allowDataOverflow
                tickFormatter={formatAxisPrice}
                width={52}
                tick={{ fontSize: 11, fill: "#ffffff", fillOpacity: 0.6 }}
                stroke="#ffffff"
                strokeOpacity={0.2}
                label={{
                  value: "Price ($)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#ffffff", fillOpacity: 0.4, fontSize: 11 },
                }}
              />
              <YAxis
                yAxisId="risk"
                orientation="right"
                scale={metricScale}
                domain={metricScale === "log" ? [0.01, 1] : [0, 1]}
                ticks={metricScale === "log" ? RISK_TICKS_LOG : RISK_TICKS}
                allowDataOverflow
                tick={{ fontSize: 11, fill: "#ffffff", fillOpacity: 0.6 }}
                stroke="#ffffff"
                strokeOpacity={0.2}
                label={{
                  value: "Risk",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "#ffffff", fillOpacity: 0.4, fontSize: 11 },
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Line
                yAxisId="price"
                dataKey="price"
                name="BTC Price"
                stroke={PRICE_COLOR}
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="risk"
                dataKey="risk"
                name="BTC Risk"
                stroke={RISK_COLOR}
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-white/70">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5" style={{ backgroundColor: PRICE_COLOR }} />
          BTC Price
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5" style={{ backgroundColor: RISK_COLOR }} />
          BTC Risk
        </span>
      </div>
    </div>
  );
}
