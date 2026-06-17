# Implementation Notes — BTC Risk Dashboard MVP

Living doc. Tracks decisions made during the build and open questions to revisit.
See `btc-risk-dashboard.md` for the full spec.

## Status — MVP COMPLETE ✅

- [x] Repo recon (pnpm monorepo: Next 16 / React 19 / Tailwind 4 / tRPC 11 + TanStack Query / better-auth)
- [x] Data layer (Bitstamp fetch + risk compute) as `btcRisk` tRPC procedure, 24h in-memory cache
- [x] Recharts BTC risk chart — matched to Benjamin Cowen's screenshot (2 lines on black)
- [x] Render on home page (public)
- [x] Vitest tests for risk formula (6 passing)
- [x] Typecheck (api) + oxlint/oxfmt (my files clean) + live run + visual verify vs screenshot
- [ ] Commit (in progress)

Verified live: 5,411 daily candles fetched (2011-08-25 → today), 5,047 risk points.
Latest risk ≈ 0.200 (ITC shows 0.296 — see Q1). Tops/bottoms align with ITC (table below).

## Decisions

- **D1 — Data layer = tRPC procedure, not a bare route handler.** The spec sketched
  `app/api/btc-risk/route.ts`, but the repo already standardizes data fetching on tRPC +
  TanStack Query (`healthCheck`, `privateData`). Added a public `btcRisk` procedure in
  `packages/api` instead, so the client uses the same `trpc.*.queryOptions()` pattern.
- **D2 — Domain logic lives in `packages/api/src/lib/`** (`risk.ts`, `bitstamp.ts`,
  `btc-risk.ts`). Pure & framework-free → unit-testable.
- **D3 — Data source: Bitstamp OHLC (keyless), NOT CryptoCompare.** ⚠️ During the build,
  CryptoCompare `histoday` started returning **HTTP 401 "API key required"** (rebranded to
  CoinDesk Data) — the keyless path the spec assumed is gone. Switched to **Bitstamp**
  `/v2/ohlc/btcusd` which is fully keyless and serves daily BTC/USD back to **2011-08-25**
  (longest no-auth history available). Paginates forward from genesis in ≤30 pages of 1000.
  CoinGecko was already ruled out (365-day free cap).
- **D4 — Server-side caching: in-memory module-level cache with 24h TTL + in-flight dedup.**
  Cold start does ~6 paginated Bitstamp calls, then serves from memory. TanStack Query caches
  client-side. No key/env needed.
- **D5 — `createContext` made resilient.** Wrapped `auth.api.getSession` in try/catch returning
  a null session, so public chart data does not require the local auth DB (`db:local`) to be
  running. Protected procedures still enforce auth.
- **D6 — Chart on the public home page** (replaces the boilerplate ASCII art). MVP is a personal
  dashboard; no reason to gate charts behind login.
- **D7 — Chart matched to Benjamin Cowen's actual screenshot (REVISED).** Initial version used
  a rainbow gradient price line + 10 colored risk bands (BitcoinRaven plotly style). The user's
  screenshot showed ITC's real "Historical Risk Levels" chart is simpler: **two clean lines on a
  pure-black background** — a **blue** BTC price line (log, left axis) and a **red** BTC risk line
  (0–1, right axis), with a `Latest Value | Confidence` header and Price/Metric scale toggles.
  Rewrote the Recharts component to match exactly; deleted the unused `risk-colors.ts`. Kept a
  bonus range selector (All/4Y/2Y/1Y). `Confidence: 9` is hardcoded BTC metadata (see Q7).
  Chart lib: Recharts `ComposedChart` + two `Line`s + dual `YAxis` (Lightweight Charts not needed).
- **D8 — Risk formula** (from spec): `risk = minMax( (ln(price) − ln(SMA365)) × dayIndex^0.395 )`
  using **global** min/max (published retro look). `dayIndex` is 1-based from start of history.
- **D9 — Default theme set to `dark`** to match the ITC aesthetic.

## Algo fidelity vs ITC (measured against the screenshot)

Our approximation tracks Cowen's red risk line well at cycle extremes:

| Point            | Ours  | ITC (screenshot) |
|------------------|-------|------------------|
| 2013-11 top      | 0.905 | ~0.95            |
| 2017-12 top      | 0.990 | ~1.0             |
| 2021-04 top      | 0.823 | ~0.85            |
| 2018-12 bottom   | 0.015 | ~0.10            |
| 2022-11 bottom   | 0.050 | ~0.15            |
| Latest (2026-06) | 0.200 | 0.296            |

Tops/placement are excellent. Our **low end runs ~0.1 under ITC** (bottoms hit 0, latest 0.20 vs
0.296) — a consistent compression from the `^0.395` dampening + global min/max. See Q1/Q3.

## Open Questions (revisit later)

- **Q1 — Risk low-end compression.** Our risk floor touches 0 and the latest value (0.200) sits
  ~0.1 below ITC's (0.296). Likely fixable by raising the dampening exponent (~0.42–0.45) and/or
  using a softer normalization (percentile clip instead of raw global min/max). Worth tuning
  `computeRisk` constants against more screenshot reference points. Cowen's exact formula is
  unpublished, so this stays an approximation.
- **Q2 — Causal vs retro normalization.** Global min/max means new all-time highs/lows can shift
  past risk values slightly. A causal `cummin/cummax` variant avoids look-ahead but reads
  differently. `computeRisk` is structured to add this as an option.
- **Q3 — SMA window.** Using 365. Cowen references ~50-week (~350). `computeRisk` already takes a
  `window` option; could expose a UI control or tune.
- **Q4 — `server_private.pem` committed at repo root.** ⚠️ Looks like a stray private key in the
  boilerplate first commit — recommend the user remove it and add to `.gitignore`. NOT touched.
- **Q5 — Pre-existing boilerplate lint errors.** `pnpm check` fails on 3 issues that predate this
  work (`packages/db/src/schema/index.ts` empty export, `packages/env/src/web.ts` unused `z`,
  `apps/web/src/app/dashboard/dashboard.tsx` unused `session` param). My files lint clean; left
  the boilerplate untouched. Trivial to fix when convenient.
- **Q6 — History persistence.** In-memory cache is lost on server restart (re-fetches ~6 Bitstamp
  calls). Consider persisting raw history to gitignored JSON/SQLite for dev speed + resilience.
- **Q7 — Confidence value.** `Confidence: 9` is hardcoded (BTC). ITC assigns 1–9 per asset by how
  many cycles are available to fit. Make it per-asset metadata when more assets are added.
- **Q8 — Next expansions.** ETH risk (reuse `computeRisk`), total-market-cap risk, dominance,
  FRED macro (M2/DXY/CPI/yields), asset dropdown + MA control (the screenshot has both).
