"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "@/app/Hooks/useAccount";
import { useResource } from "@/app/Hooks/useResource";
import { fetchCandles, fetchDashboard, fetchMarketNews } from "@/lib/api/dashboard";
import { PINNED_ASSETS_CHANGED_EVENT, readPinnedAssets } from "@/lib/client/watchlist-storage";
import { buildEquityCurve, buildHoldingRows, buildSummary } from "@/lib/portfolio";
import type { Asset } from "@/lib/client/markets";
import type { RangeKey, WatchItem } from "@/types/trading";
import { DashboardActivity } from "./components/DashboardActivity";
import { DashboardIndices } from "./components/DashboardIndices";
import { HeroCard } from "./components/HeroCard";
import { NewsCard } from "./components/NewsCard";
import { WatchlistCard, type WatchRow } from "./components/WatchlistCard";

const unique = (a: string[]) => [...new Set(a)];
const topStocks: WatchItem[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
];

export default function Home() {
  const account = useAccount();
  const [range, setRange] = useState<RangeKey>("1M");
  const [pinnedAssets, setPinnedAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const refreshPins = () => {
      try {
        setPinnedAssets(readPinnedAssets());
      } catch (error) {
        console.error("Failed to load dashboard watchlist pins:", error);
      }
    };
    refreshPins();
    window.addEventListener(PINNED_ASSETS_CHANGED_EVENT, refreshPins);
    return () => window.removeEventListener(PINNED_ASSETS_CHANGED_EVENT, refreshPins);
  }, []);

  const watchItems = useMemo(() => {
    const pinned = pinnedAssets.map(({ symbol, name }) => ({ symbol, name }));
    return pinned.length ? pinned : topStocks;
  }, [pinnedAssets]);

  const held = useMemo(() => account?.positions.map((p) => p.symbol) ?? [], [account]);
  const quoteSymbols = useMemo(
    () => unique([...held, ...watchItems.map((item) => item.symbol)]),
    [held, watchItems],
  );
  const candleSymbols = useMemo(
    () => unique([...held, "SPY", "QQQ", "DIA", ...watchItems.slice(0, 5).map((item) => item.symbol)]),
    [held, watchItems],
  );

  const dash = useResource((s) => fetchDashboard(quoteSymbols, s), quoteSymbols.join(","), {
    enabled: !!account, refreshMs: 30_000,
  });
  const newsResource = useResource(fetchMarketNews, "market-news", { refreshMs: 120_000 });
  const daily = useResource((s) => fetchCandles(candleSymbols, "1day", s), candleSymbols.join(","), {
    enabled: !!account && candleSymbols.length > 0, refreshMs: 600_000,
  });
  const intraday = useResource((s) => fetchCandles(candleSymbols, "15min", s), candleSymbols.join(","), {
    enabled: !!account && range === "1D" && candleSymbols.length > 0, refreshMs: 120_000,
  });
  const curveSrc = range === "1D" ? intraday : daily;

  const quotes = dash.data?.quotes;
  const rows = useMemo(
    () => (account ? buildHoldingRows(account.positions, quotes ?? {}, daily.data?.series ?? {}) : []),
    [account, quotes, daily.data],
  );
  const summary = useMemo(() => (account ? buildSummary(account, rows) : null), [account, rows]);
  const points = useMemo(
    () =>
      account
        ? buildEquityCurve({
            range, account,
            daily: daily.data?.series ?? {}, intraday: intraday.data?.series ?? {},
            liveTotal: quotes ? summary?.totalValue : undefined,
          })
        : [],
    [account, range, daily.data, intraday.data, quotes, summary],
  );

  const watchRows: WatchRow[] = useMemo(
    () =>
      watchItems
        .map((item) => ({
          ...item,
          quote: quotes?.[item.symbol] ?? null,
          spark: daily.data?.series[item.symbol]?.c ?? [],
        }))
        .sort(
          (a, b) =>
            Math.abs(b.quote?.changePct ?? 0) -
            Math.abs(a.quote?.changePct ?? 0),
        ),
    [watchItems, quotes, daily.data],
  );

  const pricesLoading = !account || (dash.loading && !dash.data);
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "2-digit",
  }).format(new Date());

  return (
    <main className="dashboard-scale flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1 flex-col bg-base px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex w-full flex-1 flex-col">
        <div className="mb-4 flex shrink-0 items-end justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-content-muted">
              {today}
            </p>
            <h1 className="mt-1 font-display text-[26px] font-semibold leading-none text-opposite">
              Dashboard
            </h1>
          </div>
          <Link
            href="/markets"
            className="inline-flex h-9 items-center rounded-md bg-content px-3 text-[13px] font-semibold text-base transition-opacity hover:opacity-85"
          >
            + New order
          </Link>
        </div>

        <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-lg border border-elevated bg-surface">
          <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.86fr)]">
            <div className="min-w-0">
              <HeroCard
                summary={pricesLoading ? null : summary}
                stale={!!dash.error && !dash.data}
                range={range}
                onRange={setRange}
                points={points}
                curve={{
                  loading: !account || curveSrc.loading,
                  error: curveSrc.error && !curveSrc.data ? curveSrc.error : null,
                  onRetry: curveSrc.reload,
                }}
              />
              <DashboardIndices history={daily.data?.series ?? {}} />
              <DashboardActivity
                rows={rows}
                orders={account?.orders ?? []}
                cash={account?.cash ?? 100}
              />
            </div>
            <aside className="flex min-w-0 flex-col border-t border-elevated lg:border-l lg:border-t-0">
              <WatchlistCard
                className="min-w-0"
                rows={watchRows}
                loading={pricesLoading}
                error={dash.error}
                onRetry={dash.reload}
              />
              <NewsCard
                className="min-w-0 flex-1"
                news={newsResource.data ?? []}
                loading={newsResource.loading && !newsResource.data}
                error={newsResource.error}
                onRetry={newsResource.reload}
              />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
