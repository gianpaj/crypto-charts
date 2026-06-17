# Spec: "Into The Cryptoverse"-style Crypto Dashboard

## Context

Recreate (for personal use) a dashboard of crypto + economic charts similar to Benjamin
Cowen's **Into The Cryptoverse** (paywalled). The signature artifact is the **"BTC Historical
Risk Levels"** chart: BTC price on a log axis, each point color-graded by a 0–1 "risk" value
(green = low/accumulate → red = high/distribute), over colored horizontal risk bands.

**Decisions (confirmed with user):**
- **Stack:** Next.js + React; charts with **Recharts** (escalate to TradingView Lightweight
  Charts only if a specific price chart needs it).
- **Risk model:** transparent **open approximation** of Cowen's proprietary metric (not a copy).
- **Data:** **free-tier APIs only.**
- **Scope (v1):** ship the **BTC risk chart end-to-end first**, then expand.

This spec covers v1 (the BTC risk chart) with the architecture set up so additional charts
(ETH risk, dominance, M2, ETH/BTC, macro) drop in later.

---

## Key research findings (sourced, current as of 2026)

**Data source — full BTC daily history:**
- **CoinGecko free/Demo tier silently caps `days=max` at the last 365 days** → cannot drive a
  multi-cycle risk chart. (Rate limits: 100/min, 10k/month.)
- **Use CryptoCompare `histoday`** instead: daily BTC/USD back to ~July 2010, free API key,
  2000 records/request (paginate ~3×), 100k calls/month. Primary source.
- Binance `/api/v3/klines` (no key) is good for recent OHLCV but BTCUSDT only starts 2017-08 —
  keep as a fallback/cross-check, not primary.
- Macro (later charts): **FRED API** — free key, 120/min. Series: `M2SL` (M2), `DTWEXBGS`
  (broad USD index — FRED has no literal DXY), `CPIAUCSL` (CPI), `DFF`/`FEDFUNDS` (Fed funds),
  `T10Y2Y` (yield spread).
- BTC dominance (later): no free historical endpoint; derive as BTC mcap ÷ total mcap.

**Risk metric — canonical open approximation** (from `BitcoinRaven/Bitcoin-Risk-Metric-V2`):
```
sma     = rollingMean(close, 365)                       # 365-day SMA
preavg  = (ln(close) - ln(sma)) * (dayIndex ** 0.395)   # log-ratio × time dampening
risk    = (preavg - min(preavg)) / (max(preavg) - min(preavg))   # min-max → 0..1
```
- `dayIndex` is the 1-based integer day number from start of history. `0.395` is the
  well-known "diminishing returns" exponent that makes cycle tops land at comparable risk.
- Use global `min`/`max` for the published retro look; `cummin`/`cummax` is the causal
  (no-look-ahead) variant — note in code, default to global min/max for v1.
- **Color:** map risk through a **reversed RdYlGn** scale (green low → red high), drawn as
  **10 bands of width 0.1** behind the series.

Sources: BitcoinRaven/Bitcoin-Risk-Metric-V2, carterdemars/btc_risk_metric (RdYlGn banding),
CryptoCompare histoday docs, FRED API docs.

---

## Architecture (v1)

Next.js App Router + TypeScript + Tailwind. Data fetched & risk computed **server-side**,
cached aggressively (free-tier friendly), rendered by a client Recharts component.

```
crypto-charts/
  app/
    layout.tsx              # dark theme shell, ITC-like styling
    page.tsx                # dashboard grid; v1 renders <RiskChart/>
    api/btc-risk/route.ts   # GET: returns [{date, price, risk}] (cached 1/day)
  lib/
    cryptocompare.ts        # paginated histoday fetch -> {date, close}[]
    risk.ts                 # SMA365 + risk formula (pure, unit-testable)
    colors.ts               # risk(0..1) -> hex via reversed RdYlGn; 10 band defs
  components/
    RiskChart.tsx           # 'use client' Recharts chart + range selector
    ChartCard.tsx           # reusable titled card wrapper (for future charts)
  data/
    btc-history.json        # optional on-disk cache of raw history (dev convenience)
    refs/                   # user reference screenshots for visual tuning
  docs/specs/               # this spec
  __tests__/risk.test.ts    # assert tops≈high risk, bottoms≈low risk
  .env.local                # CRYPTOCOMPARE_API_KEY (+ FRED_API_KEY for later)
```

### Data + caching flow
1. `lib/cryptocompare.ts`: fetch `histoday` (fsym=BTC, tsym=USD, limit=2000, paginate via
   `toTs`) until ~2010; return ascending `{date, close}[]` (~5,600 rows).
2. `api/btc-risk/route.ts`: load history → `computeRisk()` → return `{date, price, risk}[]`.
   Cache with `export const revalidate = 86400` (+ optionally persist raw history to
   `data/btc-history.json`). 100k/month budget is ample.
3. `RiskChart.tsx` fetches `/api/btc-risk` and renders.

### Chart rendering (Recharts) — the rainbow look
- **`<ComposedChart>`** with **log-scale Y** for price (`<YAxis scale="log" domain={['auto','auto']}/>`).
- Price as a **`<Scatter>`** with small dots, one **`<Cell fill={riskToColor(d.risk)}/>`** per
  point → color-graded line without segment hacks. A faint `<Line dot={false}>` underneath
  connects them.
- Background risk bands via **10× `<ReferenceArea>`** (or a right-hand 0–1 risk axis), colors
  from `lib/colors.ts`.
- Time-range buttons (All / 4y / 1y) filtering client-side. Tooltip: date, price, risk (2-dp).
  Dark theme, thin grid, monospace numerics.

> Fallback: if Recharts' log axis / per-point fill proves limiting for the exact feel, use
> **Lightweight Charts** for this one chart only. Recharts Scatter+Cell is expected to suffice.

### Styling
Dark navy/near-black background, muted gridlines, green→red risk palette, titled `ChartCard`,
top bar with chart name. Tune palette/opacity/axes against screenshots in `data/refs/`.

---

## Build steps (v1)

1. `npx create-next-app@latest crypto-charts` (TS, Tailwind, App Router) — into this folder
   structure. `git init`.
2. Free **CryptoCompare** API key → `.env.local`.
3. `lib/cryptocompare.ts`: paginated histoday fetcher (+ optional JSON disk cache).
4. `lib/risk.ts`: `computeRisk(rows)` (SMA365 + `0.395` dampening + min-max norm).
   `lib/colors.ts`: `riskToColor()` (reversed RdYlGn) + 10 band defs.
5. `app/api/btc-risk/route.ts`: fetch → risk → cached JSON response.
6. `components/RiskChart.tsx` + `ChartCard.tsx`; render in `app/page.tsx`.
7. Dark-theme styling pass against reference screenshots.
8. Unit test for `risk.ts`.

---

## Verification

- **Unit:** risk near **2017-12 & 2021-11 tops ≈ 0.8–1.0**, near **2018-12 & 2022-11 bottoms ≈
  0.0–0.2**, all in [0,1].
- **Manual:** `npm run dev` → log-price line color-graded green→red, 10 bands render, range
  buttons work, tooltip sane.
- **Visual:** side-by-side with user's "BTC Historical Risk Levels" screenshot; tune.
- **Free-tier sanity:** ~3 CryptoCompare calls cold, 0 warm (revalidate 1/day).

---

## Out of scope for v1 (next iterations; architecture supports)
ETH risk (reuse `risk.ts`), BTC dominance (derived mcap ratio), M2 / DXY / CPI / yield macro
charts via FRED, ETH/BTC ratio, multi-chart tabbed/grid layout, shared data-cache layer.
Each new chart = a new `lib/*` fetcher + a `ChartCard` on the grid.
