"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/app/Hooks/useAccount";
import { useResource } from "@/app/Hooks/useResource";
import { fetchCandles, fetchDashboard, fetchMarketNews } from "@/lib/api/dashboard";
import { PINNED_ASSETS_CHANGED_EVENT, readPinnedAssets } from "@/lib/client/watchlist-storage";
import { buildEquityCurve, buildHoldingRows, buildSummary } from "@/lib/portfolio";
import type { Asset } from "@/lib/client/markets";
import type { RangeKey, WatchItem } from "@/types/trading";
import { HeroCard } from "./componets/dashboard/HeroCard";
import { HoldingsCard } from "./componets/dashboard/HoldingsCard";
import { NewsCard } from "./componets/dashboard/NewsCard";
import { OrdersCard } from "./componets/dashboard/OrdersCard";
import { WatchlistCard, type WatchRow } from "./componets/dashboard/WatchlistCard";

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
  const candleSymbols = useMemo(() => (held.length ? unique([...held, "SPY"]) : []), [held]);

  const dash = useResource((s) => fetchDashboard(quoteSymbols, s), quoteSymbols.join(","), {
    enabled: !!account, refreshMs: 30_000,
  });
  const newsResource = useResource(fetchMarketNews, "market-news", { refreshMs: 120_000 });
  const daily = useResource((s) => fetchCandles(candleSymbols, "1day", s), candleSymbols.join(","), {
    enabled: candleSymbols.length > 0, refreshMs: 600_000,
  });
  const intraday = useResource((s) => fetchCandles(candleSymbols, "15min", s), candleSymbols.join(","), {
    enabled: range === "1D" && candleSymbols.length > 0, refreshMs: 120_000,
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

  const watchRows: WatchRow[] = useMemo(() =>
    watchItems
      .map((item) => ({ ...item, quote: quotes?.[item.symbol] ?? null }))
      .sort((a, b) => Math.abs(b.quote?.changePct ?? 0) - Math.abs(a.quote?.changePct ?? 0)),
  [watchItems, quotes]);

  const pricesLoading = !account || (dash.loading && !dash.data);
  return (
    <main className="dashboard-scale min-w-0 flex-1 bg-base px-4 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-[17px] font-medium text-opposite min-[761px]:text-[20px]">Dashboard</h1>
        </div>

        <div className="grid grid-cols-12 gap-4 min-[761px]:gap-5">
          <div className="col-span-12">
            <HeroCard
              summary={pricesLoading ? null : summary}
              stale={!!dash.error && !dash.data}
              range={range}
              onRange={setRange}
              points={points}
              curve={{
                loading: !account || (candleSymbols.length > 0 && curveSrc.loading),
                error: curveSrc.error && !curveSrc.data ? curveSrc.error : null,
                empty: !!account && !account.positions.length,
                onRetry: curveSrc.reload,
              }}
            />
          </div>
          <div className="col-span-12 min-[1100px]:col-span-8">
            <HoldingsCard className="flex h-[380px] min-h-0 flex-col overflow-hidden min-[761px]:h-[456px]" rows={rows} loading={pricesLoading} error={dash.error} onRetry={dash.reload} />
          </div>
          <div className="col-span-12 min-[1100px]:col-span-4">
            <WatchlistCard className="flex h-[380px] min-h-0 flex-col overflow-hidden min-[761px]:h-[456px]" rows={watchRows} loading={pricesLoading} error={dash.error} onRetry={dash.reload} />
          </div>
          <div className="col-span-12 min-[1100px]:col-span-4">
            <OrdersCard className="h-full" orders={account?.orders ?? []} />
          </div>
          <div className="col-span-12 min-[1100px]:col-span-8">
            <NewsCard className="h-full" news={newsResource.data ?? []} loading={newsResource.loading && !newsResource.data}
              error={newsResource.error} onRetry={newsResource.reload} />
          </div>
        </div>
      </div>
    </main>
  );
}
