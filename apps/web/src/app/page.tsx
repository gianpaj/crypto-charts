import { BtcRiskChart } from "@/components/charts/btc-risk-chart";

export default function Home() {
  return (
    <div className="min-h-full bg-black">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-lg border border-white/10 bg-black p-4 sm:p-6">
          <BtcRiskChart />
        </section>
        <p className="mt-4 text-center text-xs text-white/40">
          Risk is a transparent approximation of the Into The Cryptoverse metric, not the original
          proprietary model. Data: Bitstamp (BTC/USD daily). Not financial advice.
        </p>
      </div>
    </div>
  );
}
