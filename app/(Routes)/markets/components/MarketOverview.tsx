"use client";

import Sparkline from "@/app/(Routes)/markets/components/Sparkline";
import IndexChart from "@/app/(Routes)/markets/components/IndexChart";
import { Tabs } from "@/app/componets/ui/Tabs";
import { digitsFor, fmt, signed, tone } from "@/lib/format";
import {
  getRangeSeries,
  indexList,
  ranges,
  seriesChange,
  type IndexKey,
  type Range,
} from "../market-types";
import type { Quote } from "@/lib/client/markets";
import type { Series } from "@/types/trading";

type MarketOverviewProps = {
  history: Record<string, Series>;
  historyError: string | null;
  historyKey: string;
  historyLoadedKey: string | null;
  indexQuotes: Partial<Record<IndexKey, Quote>>;
  range: Range;
  onRangeChange: (range: Range) => void;
};

export default function MarketOverview({
  history,
  historyError,
  historyKey,
  historyLoadedKey,
  indexQuotes,
  range,
  onRangeChange,
}: MarketOverviewProps) {
  const sp500Quote = indexQuotes.sp500;
  const sp500History = getRangeSeries(history.SPY, range);
  const chartData =
    sp500History.length > 1 && sp500Quote?.c
      ? sp500History.map(
        (value) =>
          (value / sp500History[sp500History.length - 1]) * sp500Quote.c!,
      )
      : [];
  const changePct =
    range === "1D" ? sp500Quote?.dp ?? null : seriesChange(sp500History);
  const changePoints =
    range === "1D"
      ? sp500Quote?.d ?? null
      : chartData.length > 1
        ? chartData[chartData.length - 1] - chartData[0]
        : null;

  return (
    <section className="mb-6 grid min-w-0 overflow-hidden rounded-xl border border-elevated bg-surface sm:mb-8 lg:grid-cols-[2fr_1fr]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-ui-sm text-content-secondary">S&amp;P 500</div>
            <div className="font-display text-4xl font-bold tabular-nums text-opposite">
              {sp500Quote?.c != null ? fmt(sp500Quote.c) : "—"}
            </div>
            <div
              className={`flex flex-wrap items-center gap-x-2 text-ui-sm font-medium tabular-nums ${changePct === null ? "text-content-muted" : tone(changePct)}`}
            >
              {changePct === null ? "—" : signed(changePct, 2, "%")}{" "}
              <span className="font-normal text-content-muted">
                {range === "1D" ? "today" : `past ${range}`}
              </span>
              {changePoints !== null && (
                <span className="font-normal">
                  ({signed(changePoints, digitsFor(changePoints))} pts)
                </span>
              )}
            </div>
          </div>
          <Tabs items={ranges} value={range} onChange={onRangeChange} />
        </div>
        <div className="mt-4 h-44">
          {chartData.length > 1 ? (
            <IndexChart data={chartData} positive={(changePct ?? 0) >= 0} />
          ) : (
            <div className="flex h-full items-center text-ui-sm text-content-muted">
              {historyError
                ? `Price history unavailable: ${historyError}`
                : historyLoadedKey !== `${range}:${historyKey}`
                  ? "Loading price history…"
                  : "Price history is not available for this range."}
            </div>
          )}
        </div>
      </div>

      <ul className="grid min-w-0 grid-cols-2 divide-x divide-y divide-elevated border-t border-elevated lg:flex lg:flex-col lg:divide-x-0 lg:border-l lg:border-t-0">
        {indexList
          .filter((index) => index.key !== "sp500")
          .map((index) => {
            const quote = indexQuotes[index.key];
            const indexHistory = getRangeSeries(history[index.proxy], range);
            return (
              <li
                key={index.key}
                className="flex min-w-0 flex-col gap-2 p-3 sm:p-4 lg:flex-1 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-5 lg:py-4"
              >
                <div className="min-w-0">
                  <div className="text-ui-sm text-content-secondary">
                    {index.name}
                  </div>
                  <div className="font-display text-ui-lg font-semibold tabular-nums text-opposite">
                    {quote?.c != null ? fmt(quote.c) : "—"}
                  </div>
                  <div
                    className={`hidden text-xs tabular-nums sm:block ${quote?.d == null ? "text-content-muted" : tone(quote.d)}`}
                  >
                    {quote?.d == null
                      ? "—"
                      : `${signed(quote.d, digitsFor(quote.d))} pts`}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 lg:justify-end lg:gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-content-muted">Today</div>
                    <div
                      className={`text-ui-sm font-medium tabular-nums ${quote?.dp == null ? "text-content-muted" : tone(quote.dp)}`}
                    >
                      {quote?.dp == null ? "—" : signed(quote.dp, 2, "%")}
                    </div>
                  </div>
                  <span className="hidden lg:block">
                    {indexHistory.length > 1 ? (
                      <Sparkline
                        data={indexHistory}
                        positive={(quote?.dp ?? 0) >= 0}
                        width={64}
                        height={22}
                      />
                    ) : (
                      <span className="w-16 text-right text-xs text-content-muted">
                        —
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
