"use client";

import { getMarketIndexQuote, type Quote as MarketQuote } from "@/lib/client/markets";
import { fmt, signedPct, toneText } from "@/lib/format";
import { useResource } from "@/app/Hooks/useResource";
import type { Series } from "@/types/trading";
import { Sparkline } from "./Sparkline";

const indexes = [
  { key: "sp500", name: "S&P 500", proxy: "SPY" },
  { key: "nasdaq", name: "Nasdaq 100", proxy: "QQQ" },
  { key: "dow", name: "Dow Jones", proxy: "DIA" },
] as const;

type IndexQuotes = Partial<Record<(typeof indexes)[number]["key"], MarketQuote>>;

async function loadIndexes(signal: AbortSignal) {
  const results = await Promise.allSettled(
    indexes.map(async ({ key }) => [
      key,
      await getMarketIndexQuote(key, signal),
    ] as const),
  );
  const quotes: IndexQuotes = {};
  const errors: string[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      quotes[result.value[0]] = result.value[1];
    } else if ((result.reason as Error)?.name !== "AbortError") {
      errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : "Could not load market index quotes.",
      );
    }
  });

  if (!Object.keys(quotes).length && errors.length) {
    throw new Error(errors.join(" "));
  }
  return { quotes, error: errors.join(" ") || null };
}

export function DashboardIndices({
  history,
}: {
  history: Record<string, Series>;
}) {
  const resource = useResource(loadIndexes, "dashboard-indexes", {
    refreshMs: 60_000,
  });
  const data = resource.data;

  return (
    <section
      aria-label="Market indexes"
      className="grid grid-cols-1 divide-y divide-elevated border-b border-elevated sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      {indexes.map((index) => {
        const quote = data?.quotes[index.key];
        const series = history[index.proxy]?.c ?? [];
        return (
          <div
            key={index.key}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] text-content-muted">{index.name}</p>
              <p className="mt-0.5 text-[18px] font-medium leading-tight text-opposite tabular-nums">
                {quote ? fmt(quote.c ?? 0) : "—"}
              </p>
              <p
                className={`text-[13px] tabular-nums ${quote?.dp == null ? "text-content-muted" : toneText(quote.dp)}`}
              >
                {quote?.dp == null ? "—" : signedPct(quote.dp)}
              </p>
            </div>
            <Sparkline values={series.slice(-12)} up={(quote?.dp ?? 0) >= 0} />
          </div>
        );
      })}
      {resource.error && !data && (
        <p role="status" className="col-span-full px-4 py-2 text-[13px] text-danger">
          Market indexes unavailable: {resource.error}
        </p>
      )}
      {data?.error && (
        <p role="status" className="col-span-full px-4 py-2 text-[13px] text-danger">
          Some market indexes are unavailable: {data.error}
        </p>
      )}
    </section>
  );
}
