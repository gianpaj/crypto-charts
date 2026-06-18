# crypto-charts

A crypto dashboard inspired by [Into The Cryptoverse](https://intothecryptoverse.com).
The first chart recreates Benjamin Cowen's **BTC Historical Risk Levels**: Bitcoin price on a
log axis (blue) alongside a 0–1 "risk" metric (red), where low risk highlights long-term
accumulation zones and high risk highlights distribution zones.

### 🔗 Live: https://gianpaj.github.io/crypto-charts/

> Risk here is a **transparent, open approximation** of Cowen's metric (his exact formula is
> unpublished). Not financial advice.

## The risk metric

```
risk = minMax( (ln(price) − ln(SMA365)) × dayIndex^0.395 )
```

- `ln(price) − ln(SMA365)` — how stretched price is above/below its ~1-year moving average.
- `× dayIndex^0.395` — the diminishing-returns dampening so cycle tops land at comparable risk.
- `minMax → 0..1` — normalized over all history (all-time hottest = 1, coldest = 0).

Implemented in `packages/api/src/lib/risk.ts` (pure, unit-tested with Vitest).

## Data

Daily BTC/USD history comes from **Bitstamp** (keyless, back to 2011-08-25). At build time
`apps/web/scripts/generate-risk-data.mts` fetches the history, computes risk, and writes
`apps/web/public/data/btc-risk.json`. The static site loads that JSON in the browser — no
server, no API keys. CoinGecko's free tier caps at 365 days and CryptoCompare now requires a
key, so Bitstamp is used for full history.

## Deployment (GitHub Pages)

The app is a fully static export (`output: "export"`) deployed via GitHub Actions
(`.github/workflows/deploy.yml`) — on push to `main`, on a daily cron (refreshes the risk
data), and on manual dispatch.

One-time setup: **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.

## Local development

```bash
pnpm install
pnpm --filter web generate-data   # fetch BTC history + compute risk -> public/data/btc-risk.json
pnpm dev:web                       # http://localhost:3001
```

Build the static site locally (as Pages does):

```bash
pnpm --filter web generate-data
NEXT_PUBLIC_BASE_PATH=/crypto-charts pnpm --filter web build   # output in apps/web/out
```

## Status

Auth and database functionality are **currently disabled** to keep the site static. The
`packages/{auth,db,api}` packages remain in the repo (just not imported by the web app), so
login/DB can be re-enabled later. See `docs/specs/` for the spec, decisions, and open questions.

## Project structure

```
crypto-charts/
├── apps/
│   └── web/            # Static Next.js site (the dashboard)
│       ├── scripts/    # build-time risk-data generator
│       └── public/data # generated btc-risk.json
├── packages/
│   ├── ui/             # Shared shadcn/ui components and styles
│   ├── api/            # Risk metric + data fetching (lib/) — reused by the build script
│   ├── auth/           # Authentication (disabled for now)
│   └── db/             # Database schema (disabled for now)
└── docs/specs/         # Spec, implementation notes, decisions
```

## Scripts

- `pnpm dev:web` — run the web app in dev
- `pnpm --filter web generate-data` — regenerate the risk JSON
- `pnpm --filter web build` — static production build (`apps/web/out`)
- `pnpm --filter @crypto-charts/api test` — run the risk-metric unit tests
- `pnpm check` — Oxlint + Oxfmt

## Tech

TypeScript · Next.js (static export) · React · Recharts · TanStack Query · Tailwind · Vitest ·
Oxlint/Oxfmt · pnpm workspaces. Built with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack).
