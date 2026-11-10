"use client";

import { ConfigProvider, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Account, Position } from "@/types/trading";
import type { Quote } from "@/lib/client/markets";
import { digitsFor, fmt, signed, tone } from "@/lib/format";
import { money } from "../market-types";
import type { calculateHoldings } from "../market-types";

type HoldingsSummary = ReturnType<typeof calculateHoldings>;

type MarketHoldingsProps = {
  account: Account | null;
  holdings: HoldingsSummary;
  pinnedCount: number;
  quotes: Map<string, Quote>;
  onBrowse: (filter: "Pinned" | "S&P 500") => void;
};

const tableTheme = {
  token: { colorBgContainer: "transparent" },
  components: {
    Table: {
      headerBg: "transparent",
      headerColor: "var(--color-content-muted)",
      headerSplitColor: "transparent",
      borderColor: "var(--color-elevated)",
      rowHoverBg: "var(--color-surface)",
      cellPaddingBlock: 12,
    },
  },
};

export default function MarketHoldings({
  account,
  holdings,
  pinnedCount,
  quotes,
  onBrowse,
}: MarketHoldingsProps) {
  const holdingColumns: ColumnsType<Position> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      render: (_, position) => {
        const logo = quotes.get(position.symbol)?.logo;
        return (
          <div className="flex items-center gap-3">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="h-8 w-8 rounded-sm bg-white object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-sm bg-elevated" aria-hidden />
            )}
            <div className="leading-tight">
              <div className="text-ui-sm font-semibold text-opposite">
                {position.symbol}
              </div>
              <div className="text-xs text-content-secondary">
                {position.name}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Shares",
      dataIndex: "shares",
      align: "right",
      width: 100,
      responsive: ["md"],
      render: (shares: number) => (
        <span className="tabular-nums text-content-secondary">
          {fmt(shares, 4).replace(/\.?0+$/, "")}
        </span>
      ),
    },
    {
      title: "Avg cost",
      dataIndex: "avgCost",
      align: "right",
      width: 120,
      responsive: ["md"],
      render: (value: number) => (
        <span className="tabular-nums text-content-secondary">
          ${fmt(value, digitsFor(value))}
        </span>
      ),
    },
    {
      title: "Price",
      dataIndex: "symbol",
      align: "right",
      width: 120,
      render: (symbol: string) => {
        const price = quotes.get(symbol)?.c;
        return (
          <span className="tabular-nums text-opposite">
            {price == null ? "—" : `$${fmt(price, digitsFor(price))}`}
          </span>
        );
      },
    },
    {
      title: "Today",
      dataIndex: "symbol",
      align: "right",
      width: 120,
      render: (symbol: string) => {
        const quote = quotes.get(symbol);
        if (quote?.dp == null || quote.d == null) {
          return <span className="text-content-muted">—</span>;
        }
        return (
          <div className={`leading-tight tabular-nums ${tone(quote.d)}`}>
            <div className="font-medium">{signed(quote.dp, 2, "%")}</div>
            <div className="text-xs opacity-70">
              {signed(quote.d, digitsFor(quote.d))}
            </div>
          </div>
        );
      },
    },
    {
      title: "Return",
      dataIndex: "symbol",
      align: "right",
      width: 130,
      render: (symbol: string, position: Position) => {
        const price = quotes.get(symbol)?.c;
        if (price == null || position.avgCost <= 0) {
          return <span className="text-content-muted">—</span>;
        }
        const amount = (price - position.avgCost) * position.shares;
        const pct = (price / position.avgCost - 1) * 100;
        return (
          <div className={`leading-tight tabular-nums ${tone(amount)}`}>
            <div className="font-medium">{signed(pct, 2, "%")}</div>
            <div className="text-xs opacity-70">{money(amount)}</div>
          </div>
        );
      },
    },
    {
      title: "Value",
      dataIndex: "symbol",
      align: "right",
      width: 130,
      render: (symbol: string, position: Position) => {
        const price = quotes.get(symbol)?.c;
        if (price == null) return <span className="text-content-muted">—</span>;
        const value = position.shares * price;
        const weight =
          holdings.complete && holdings.value > 0
            ? (value / holdings.value) * 100
            : null;
        return (
          <div className="leading-tight tabular-nums">
            <div className="font-semibold text-opposite">${fmt(value)}</div>
            {weight !== null && (
              <div className="text-xs text-content-muted">
                {fmt(weight, 1)}%
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-ui-base font-semibold text-opposite">
            My holdings
          </h2>
          <span className="text-xs tabular-nums text-content-secondary">
            {account?.positions.length ?? 0}{" "}
            {account?.positions.length === 1 ? "position" : "positions"}
          </span>
        </div>

        {account && account.positions.length > 0 && (
          <div className="text-right">
            <div className="font-display text-ui-xl font-semibold tabular-nums text-opposite">
              {holdings.complete ? `$${fmt(holdings.value)}` : "—"}
            </div>
            {holdings.complete && (
              <div className="mt-1 flex justify-end gap-4 text-xs tabular-nums">
                <span className={tone(holdings.day)}>
                  {money(holdings.day)}{" "}
                  <span className="text-content-muted">today</span>
                </span>
                <span className={tone(holdings.ret)}>
                  {money(holdings.ret)}{" "}
                  <span className="text-content-muted">total return</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!account ? (
        <p className="border-y border-elevated py-4 text-ui-sm text-content-secondary">
          Loading your account…
        </p>
      ) : account.positions.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-elevated py-5">
          <div>
            <p className="text-ui-base font-semibold text-opposite">
              You don&apos;t own any stocks yet
            </p>
            <p className="mt-1 text-ui-sm text-content-secondary">
              Buy your first stock and its value, daily change and return will
              show up here.
            </p>
          </div>
          <div className="flex gap-2">
            {pinnedCount > 0 && (
              <button
                type="button"
                onClick={() => onBrowse("Pinned")}
                className="btn btn-sm rounded-sm border-elevated bg-surface text-opposite"
              >
                View pinned ({pinnedCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => onBrowse("S&P 500")}
              className="btn btn-sm rounded-sm border-0 bg-content text-base"
            >
              Browse S&amp;P 500
            </button>
          </div>
        </div>
      ) : (
        <>
          {holdings.complete && holdings.value > 0 && (
            <div
              role="img"
              aria-label="Portfolio allocation by holding"
              className="mb-4 flex h-2 gap-px overflow-hidden rounded-sm"
            >
              {holdings.rows.map(({ position, value }, i) => {
                const pct = ((value ?? 0) / holdings.value) * 100;
                return (
                  <div
                    key={position.symbol}
                    title={`${position.symbol} ${fmt(pct, 1)}%`}
                    className="bg-opposite"
                    style={{
                      width: `${pct}%`,
                      opacity: Math.max(0.2, 0.9 - i * 0.18),
                    }}
                  />
                );
              })}
            </div>
          )}

          <ConfigProvider theme={tableTheme}>
            <Table<Position>
              rowKey="symbol"
              columns={holdingColumns}
              dataSource={holdings.rows.map((row) => row.position)}
              pagination={false}
              tableLayout="fixed"
              rowClassName={() => "group"}
            />
          </ConfigProvider>
        </>
      )}
    </section>
  );
}
