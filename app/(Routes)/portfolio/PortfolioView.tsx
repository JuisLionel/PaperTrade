"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "@/app/Hooks/useAccount";
import { useResource } from "@/app/Hooks/useResource";
import { DashboardButton } from "@/app/(Routes)/(dashboard)/components/Card";
import { EquityChart } from "@/app/(Routes)/(dashboard)/components/EquityChart";
import { Sparkline } from "@/app/(Routes)/(dashboard)/components/Sparkline";
import { fetchCandles, fetchDashboard } from "@/lib/api/dashboard";
import { dec2, num, signedPct, signedUsd, toneText, usd } from "@/lib/format";
import { addVirtualFunds } from "@/lib/storage";
import {
  buildEquityCurve,
  buildHoldingRows,
  buildSummary,
  type HoldingRow,
  type Summary,
} from "@/lib/portfolio";
import type { RangeKey } from "@/types/trading";

const unique = (values: string[]) => [...new Set(values)];

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-elevated bg-surface p-3 sm:p-4">
      <p className="truncate text-xs text-content-muted sm:text-sm">{label}</p>
      <p className="mt-2 truncate font-display text-xl font-semibold tabular-nums text-opposite sm:text-2xl">
        {value}
      </p>
      <p className={`mt-2 truncate text-xs tabular-nums ${tone ?? "text-content-muted"}`}>
        {detail}
      </p>
    </article>
  );
}

function Holding({ row }: { row: HoldingRow }) {
  const weekUp = row.spark.length < 2 || row.spark[row.spark.length - 1] >= row.spark[0];
  return (
    <div className="grid gap-2 border-b border-elevated/80 py-3 last:border-0 sm:grid-cols-[minmax(90px,1.4fr)_repeat(4,minmax(54px,0.7fr))_minmax(92px,0.9fr)_64px] sm:items-center sm:gap-2">
      <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
        <div className="min-w-0">
          <p className="font-semibold text-opposite">{row.symbol}</p>
          <p className="truncate text-xs text-content-muted">{row.name}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-medium tabular-nums text-opposite sm:hidden">
          {usd(row.marketValue)}
        </p>
      </div>
      <div className="flex justify-between gap-2 text-sm sm:block">
        <span className="text-xs text-content-muted sm:hidden">Shares</span>
        <span className="tabular-nums text-content-secondary">{num(row.shares)}</span>
      </div>
      <div className="flex justify-between gap-2 text-sm sm:block">
        <span className="text-xs text-content-muted sm:hidden">Price · Avg cost</span>
        <span className="tabular-nums text-content-secondary">
          <span className="sm:hidden">{dec2(row.last)} · {dec2(row.avgCost)}</span>
          <span className="hidden sm:inline">{dec2(row.avgCost)}</span>
        </span>
      </div>
      <div className="hidden text-right text-sm tabular-nums text-content-secondary sm:block">
        {dec2(row.last)}
      </div>
      <div className="flex justify-between gap-2 text-sm sm:block sm:text-right">
        <span className="text-xs text-content-muted sm:hidden">Value · Total P&L</span>
        <span className="hidden text-sm tabular-nums text-opposite sm:block">
          {usd(row.marketValue)}
        </span>
        <span className="sm:hidden text-content-secondary">{usd(row.marketValue)} ·</span>
        <span className={`tabular-nums ${toneText(row.pnl)}`}>
          {signedUsd(row.pnl)} <span className="text-xs opacity-80">({signedPct(row.pnlPct)})</span>
        </span>
      </div>
      <div className="hidden sm:block">
        <Sparkline values={row.spark} up={weekUp} />
      </div>
    </div>
  );
}

function AccountSummary({
  summary,
  loading,
  error,
  onRetry,
}: {
  summary: Summary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading || !summary) {
    return (
      <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-elevated bg-surface" />
        ))}
      </section>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
          Live quotes are unavailable. Showing the latest available prices.
          <button type="button" onClick={onRetry} className="font-medium underline">Retry</button>
        </div>
      )}
      <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric label="Total balance" value={usd(summary.totalValue)} detail={`${usd(summary.cash)} available cash`} />
        <Metric label="Invested" value={usd(summary.totalValue - summary.cash)} detail="Current holdings" />
        <Metric label="Today’s P&L" value={signedUsd(summary.dayPnl)} detail={`${signedPct(summary.dayPct)} today`} tone={toneText(summary.dayPnl)} />
        <Metric
          label="Total return"
          value={signedUsd(summary.totalReturn)}
          detail={`${signedPct(summary.totalReturnPct)} since start`}
          tone={toneText(summary.totalReturn)}
        />
      </section>
    </>
  );
}

const allocationColors = ["#b8e62e", "#22c98b", "#f0f0f0", "#999999", "#666666", "#454545"];

function AllocationCard({
  rows,
  cash,
  total,
}: {
  rows: HoldingRow[];
  cash: number;
  total: number;
}) {
  const allocation = useMemo(() => {
    const positions = rows
      .map((row) => ({ symbol: row.symbol, value: row.marketValue }))
      .sort((a, b) => b.value - a.value);
    const largest = positions.slice(0, 4);
    const remainder = positions.slice(4);
    const otherValue = remainder.reduce((sum, item) => sum + item.value, 0);
    return [
      ...largest,
      ...(cash > 0 ? [{ symbol: "Cash", value: cash }] : []),
      ...(otherValue > 0
        ? [{ symbol: remainder.map((item) => item.symbol).join(", "), value: otherValue }]
        : []),
    ];
  }, [rows, cash]);

  return (
    <section className="rounded-xl border border-elevated bg-surface p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-opposite">Allocation</h2>
        <span className="text-xs text-content-muted">{rows.length} positions</span>
      </header>
      {total > 0 && allocation.length ? (
        <>
          <div
            className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-elevated"
            role="img"
            aria-label={`Portfolio allocation: ${allocation.map((item) => `${item.symbol} ${((item.value / total) * 100).toFixed(1)}%`).join(", ")}`}
          >
            {allocation.map((item, index) => (
              <span
                key={item.symbol}
                className="h-full"
                style={{
                  width: `${(item.value / total) * 100}%`,
                  backgroundColor: allocationColors[index % allocationColors.length],
                }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {allocation.map((item, index) => (
              <li key={item.symbol} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-content-secondary">
                  <i
                    className="size-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: allocationColors[index % allocationColors.length] }}
                  />
                  <span className="truncate" title={item.symbol}>{item.symbol}</span>
                </span>
                <span className="shrink-0 tabular-nums text-content-muted">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-elevated px-3 py-6 text-center text-sm text-content-muted">
          Your allocation will appear after your first trade.
        </p>
      )}
    </section>
  );
}

function MoversCard({ rows }: { rows: HoldingRow[] }) {
  const movers = [...rows]
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct))
    .slice(0, 6);

  return (
    <section className="flex min-h-[220px] min-w-0 flex-col overflow-hidden rounded-xl border border-elevated bg-surface xl:flex-1">
      <header className="flex items-center justify-between gap-3 border-b border-elevated px-4 py-4 sm:px-5">
        <h2 className="font-display text-lg font-semibold text-opposite">Today’s movers</h2>
        <span className="text-xs text-content-muted">Your positions</span>
      </header>
      {movers.length ? (
        <div className="flex-1 divide-y divide-elevated/80 px-4 sm:px-5">
          {movers.map((row) => (
            <div key={row.symbol} className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-opposite">{row.symbol}</span>
                <span className="block truncate text-xs text-content-muted">{row.name}</span>
              </span>
              <Sparkline values={row.spark} up={row.dayPct >= 0} />
              <span className="text-right">
                <span className="block text-sm tabular-nums text-opposite">{dec2(row.last)}</span>
                <span className={`block text-xs tabular-nums ${toneText(row.dayPct)}`}>{signedPct(row.dayPct)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
          <p className="text-sm font-medium text-opposite">No movers yet</p>
          <p className="mt-1 text-xs text-content-muted">Your held stocks will appear here.</p>
          <Link href="/markets" className="mt-3 text-xs font-semibold text-content hover:underline">
            Explore markets
          </Link>
        </div>
      )}
    </section>
  );
}

export function PortfolioView() {
  const account = useAccount();
  const [range, setRange] = useState<RangeKey>("1M");
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [fundsAmount, setFundsAmount] = useState("100");
  const [fundsError, setFundsError] = useState<string | null>(null);
  const heldSymbols = useMemo(
    () => account?.positions.map((position) => position.symbol) ?? [],
    [account],
  );
  const quoteSymbols = useMemo(() => unique(heldSymbols), [heldSymbols]);
  const candleSymbols = useMemo(() => unique([...heldSymbols, "SPY"]), [heldSymbols]);
  const quotesResource = useResource(
    (signal) => fetchDashboard(quoteSymbols, signal),
    quoteSymbols.join(","),
    { enabled: !!account && quoteSymbols.length > 0, refreshMs: 30_000 },
  );
  const daily = useResource(
    (signal) => fetchCandles(candleSymbols, "1day", signal),
    candleSymbols.join(","),
    { enabled: !!account && candleSymbols.length > 0, refreshMs: 600_000 },
  );
  const intraday = useResource(
    (signal) => fetchCandles(candleSymbols, "15min", signal),
    candleSymbols.join(","),
    { enabled: !!account && range === "1D" && candleSymbols.length > 0, refreshMs: 120_000 },
  );
  const curveSource = range === "1D" ? intraday : daily;
  const rows = useMemo(
    () => account ? buildHoldingRows(account.positions, quotesResource.data?.quotes ?? {}, daily.data?.series ?? {}) : [],
    [account, quotesResource.data, daily.data],
  );
  const summary = useMemo(
    () => account ? buildSummary(account, rows) : null,
    [account, rows],
  );
  const points = useMemo(
    () => account ? buildEquityCurve({
      range,
      account,
      daily: daily.data?.series ?? {},
      intraday: intraday.data?.series ?? {},
      liveTotal: quotesResource.data ? summary?.totalValue : undefined,
    }) : [],
    [account, range, daily.data, intraday.data, quotesResource.data, summary],
  );
  const loading = !account || (quotesResource.loading && !quotesResource.data);

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1 flex-col bg-base px-3 py-4 sm:px-4 sm:pb-0 sm:pt-5">
      <div className="flex w-full flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-content-muted">
              {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "2-digit" }).format(new Date())}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-opposite sm:text-3xl">Portfolio</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFundsError(null);
                setAddMoneyOpen(true);
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-elevated px-4 text-sm font-semibold text-opposite transition-colors hover:border-content hover:text-content"
            >
              + Add money
            </button>
            <Link
              href="/markets"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-content px-4 text-sm font-semibold text-base transition-opacity hover:opacity-85"
            >
              + New order
            </Link>
          </div>
        </header>

        <AccountSummary
          summary={summary}
          loading={loading}
          error={quotesResource.error}
          onRetry={quotesResource.reload}
        />

        <div className="mt-4 grid min-w-0 gap-4 xl:min-h-[620px] xl:flex-1 xl:content-stretch xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.95fr)] xl:grid-rows-[auto_minmax(280px,1fr)] xl:items-stretch">
            <section className="min-w-0 rounded-xl border border-elevated bg-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-opposite sm:text-xl">Portfolio performance</h2>
                  <p className="mt-1 text-xs text-content-muted sm:text-sm">Account value over time</p>
                </div>
                <div className="flex gap-1 rounded-full bg-elevated p-1" aria-label="Chart range">
                  {(["1D", "1W", "1M", "3M", "YTD", "ALL"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={range === value}
                      onClick={() => setRange(value)}
                      className={`rounded-full px-2 py-1.5 text-xs ${range === value ? "bg-content font-semibold text-base" : "text-content-muted hover:text-opposite"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {curveSource.error && !curveSource.data ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="alert">
                  <p className="text-sm text-danger">{curveSource.error}</p>
                  <button type="button" onClick={curveSource.reload} className="text-sm text-content hover:underline">Retry chart</button>
                </div>
              ) : curveSource.loading ? (
                <div className="h-52 animate-pulse rounded-lg bg-elevated" aria-busy="true" />
              ) : points.length > 1 ? (
                <EquityChart points={points} range={range} />
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-elevated px-4 text-center text-sm text-content-muted">
                  {account?.orders.some((order) => order.status === "filled")
                    ? "Portfolio history is not available for this range."
                    : "Your chart will begin after your first completed trade."}
                </div>
              )}
            </section>

            <AllocationCard
              rows={rows}
              cash={summary?.cash ?? account?.cash ?? 100}
              total={summary?.totalValue ?? account?.cash ?? 100}
            />

            <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-elevated bg-surface xl:min-h-0">
              <header className="flex items-center justify-between gap-3 border-b border-elevated px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-display text-lg font-semibold text-opposite">Holdings</h2>
                  <p className="mt-1 text-xs text-content-muted">{rows.length} {rows.length === 1 ? "position" : "positions"}</p>
                </div>
                {rows.length > 0 && <span className="text-sm font-medium tabular-nums text-opposite">{usd(summary?.totalValue ? summary.totalValue - (summary.cash ?? 0) : 0)} invested</span>}
              </header>
              {quotesResource.error && !rows.length ? (
                <div className="px-5 py-8 text-sm text-danger" role="alert">
                  {quotesResource.error}
                  <button type="button" onClick={quotesResource.reload} className="ml-2 underline">Retry</button>
                </div>
              ) : loading ? (
                <div className="space-y-3 p-5" aria-busy="true">
                  {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded bg-elevated" />)}
                </div>
              ) : rows.length ? (
                <div className="flex-1 px-4 sm:px-5">
                  <div className="hidden grid-cols-[minmax(90px,1.4fr)_repeat(4,minmax(54px,0.7fr))_minmax(92px,0.9fr)_64px] gap-2 border-b border-elevated py-3 text-[10px] uppercase tracking-wide text-content-muted sm:grid">
                    <span>Symbol</span><span>Shares</span><span>Avg cost</span><span>Last</span><span>Value</span><span className="text-right">Total P&L</span><span className="text-center">7D</span>
                  </div>
                  {rows
                    .slice()
                    .sort((a, b) => b.marketValue - a.marketValue)
                    .map((row) => <Holding key={row.symbol} row={row} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-9 text-center sm:py-12">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-elevated text-content">
                    <span aria-hidden>＋</span>
                  </div>
                  <h3 className="font-semibold text-opposite">Your portfolio is ready</h3>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-content-muted">
                    You have {usd(account?.cash ?? 100)} in paper funds. Buy a stock to see your holdings and performance here.
                  </p>
                  <DashboardButton href="/markets" primary className="mt-4">Browse US stocks</DashboardButton>
                </div>
              )}
            </section>
            <MoversCard rows={rows} />
        </div>
      </div>
      {addMoneyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAddMoneyOpen(false);
          }}
        >
          <section
            aria-labelledby="add-money-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-elevated bg-surface p-5 shadow-2xl sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="add-money-title" className="font-display text-xl font-semibold text-opposite">
                  Add paper funds
                </h2>
                <p className="mt-1 text-sm text-content-muted">
                  Add virtual cash to your simulated account.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close add money dialog"
                onClick={() => setAddMoneyOpen(false)}
                className="rounded-full px-2 py-1 text-content-muted hover:bg-elevated hover:text-opposite"
              >
                ×
              </button>
            </div>
            <form
              className="mt-5"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  addVirtualFunds(Number(fundsAmount));
                  setAddMoneyOpen(false);
                  setFundsError(null);
                } catch (error) {
                  setFundsError(error instanceof Error ? error.message : "Could not add paper funds.");
                }
              }}
            >
              <label htmlFor="paper-funds-amount" className="text-sm font-medium text-opposite">
                Amount (USD)
              </label>
              <div className="mt-2 flex items-center rounded-lg border border-elevated bg-base px-3 focus-within:border-content">
                <span className="text-content-muted">$</span>
                <input
                  autoFocus
                  id="paper-funds-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={fundsAmount}
                  onChange={(event) => setFundsAmount(event.target.value)}
                  className="min-h-12 w-full bg-transparent px-2 text-lg tabular-nums text-opposite outline-none"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["100", "500", "1000"].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setFundsAmount(amount)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${fundsAmount === amount ? "border-content text-content" : "border-elevated text-content-muted hover:text-opposite"}`}
                  >
                    ${Number(amount).toLocaleString("en-US")}
                  </button>
                ))}
              </div>
              {fundsError && <p className="mt-3 text-sm text-danger" role="alert">{fundsError}</p>}
              <p className="mt-4 text-xs leading-relaxed text-content-muted">
                This adds simulated cash only. Your starting balance will adjust too, so it won’t count as investment profit.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddMoneyOpen(false)}
                  className="min-h-10 rounded-full border border-elevated px-4 text-sm text-content-secondary hover:text-opposite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-10 rounded-full bg-content px-4 text-sm font-semibold text-base hover:opacity-85"
                >
                  Add funds
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
