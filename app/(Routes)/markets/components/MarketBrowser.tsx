"use client";

import { useEffect, useState } from "react";
import { ConfigProvider, Pagination, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BsFillPinAngleFill, BsPinAngle } from "react-icons/bs";
import { ArrowDown, ArrowUp } from "lucide-react";
import Sparkline from "@/app/(Routes)/markets/components/Sparkline";
import { Tabs } from "@/app/componets/ui/Tabs";
import { digitsFor, fmt, signed, tone } from "@/lib/format";
import { submitAlpacaOrder } from "@/lib/api/alpaca";
import type { Account, Order, OrderSide } from "@/types/trading";
import {
  cryptoSubs,
  filters,
  PAGE_SIZE,
  type Filter,
  type MarketRow,
} from "../market-types";
import MarketOrderTicket from "./MarketOrderTicket";

type MarketBrowserProps = {
  data: MarketRow[];
  filter: Filter;
  page: number;
  pinnedSymbols: Set<string>;
  query: string;
  quotesError: string | null;
  symbolsError: string | null;
  symbolsLoading: boolean;
  cryptoSub: string;
  onCryptoSubChange: (value: string) => void;
  onFilterChange: (filter: Filter) => void;
  onPageChange: (page: number) => void;
  onTogglePin: (row: MarketRow) => void;
  account: Account | null;
  onAccountRefresh: () => Promise<void>;
};

const tableTheme = {
  token: {
    colorBgContainer: "transparent",
    colorPrimary: "var(--color-content)",
    colorPrimaryHover: "var(--color-content)",
  },
  components: {
    Table: {
      headerBg: "transparent",
      headerColor: "var(--color-content-muted)",
      headerSplitColor: "transparent",
      borderColor: "var(--color-elevated)",
      rowHoverBg: "var(--color-surface)",
      cellPaddingBlock: 12,
    },
    Pagination: {
      itemActiveBg: "var(--color-content)",
      itemActiveColor: "var(--color-base)",
      itemActiveColorHover: "var(--color-base)",
    },
  },
};

function paperSymbol(symbol: string) {
  if (!symbol.includes(":")) return symbol;
  return `${symbol.split(":")[1].replace(/USDT$/, "")}USD`;
}

export default function MarketBrowser({
  data,
  filter,
  page,
  pinnedSymbols,
  query,
  quotesError,
  symbolsError,
  symbolsLoading,
  cryptoSub,
  onCryptoSubChange,
  onFilterChange,
  onPageChange,
  onTogglePin,
  account,
  onAccountRefresh,
}: MarketBrowserProps) {
  const [ticket, setTicket] = useState<{
    side: OrderSide;
    symbol: string;
    name: string;
    price: number;
    changePct: number | null;
    buyingPower: number;
    cash: number;
    shares: number;
    fractional: boolean;
    crypto: boolean;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const mobileRows = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openTicket(row: MarketRow, side: OrderSide) {
    if (
      row.price === null ||
      !Number.isFinite(row.price) ||
      row.price <= 0 ||
      !account
    ) {
      return;
    }
    const symbol = paperSymbol(row.symbol);
    const shares =
      (account.positions.find((position) => position.symbol === symbol)?.shares ??
        0) -
      account.orders
        .filter(
          (order) =>
            order.cancelable &&
            order.side === "sell" &&
            order.symbol === symbol,
        )
        .reduce(
          (sum, order) =>
            sum + Math.max(0, order.qty - (order.filledQty ?? 0)),
          0,
        );
    const buyingPower = account.buyingPower ??
      account.cash -
      account.orders
        .filter(
          (order) =>
            order.cancelable &&
            order.side === "buy",
        )
        .reduce(
          (sum, order) =>
            sum +
            Math.max(0, order.qty - (order.filledQty ?? 0)) *
            (order.limitPrice ?? order.price),
          0,
        );
    const crypto =
      row.kind.toLowerCase().includes("crypto") || row.symbol.includes(":");
    setTicket({
      side,
      symbol,
      name: row.name,
      price: row.price,
      changePct: row.changePct,
      buyingPower,
      cash: account.cash,
      shares,
      fractional: crypto,
      crypto,
    });
  }

  async function placeOrder(
    side: OrderSide,
    type: Order["type"],
    quantity: number,
    orderPrice: number,
  ): Promise<void> {
    if (!account || !ticket) throw new Error("Your Alpaca paper account is still loading.");
    await submitAlpacaOrder({
      clientOrderId: window.crypto.randomUUID(),
      symbol: ticket.symbol,
      side,
      type,
      qty: quantity,
      price: orderPrice,
      crypto: ticket.crypto,
    });
    setTicket(null);
    setNotice(`${side === "buy" ? "Buy" : "Sell"} ${type} order submitted to Alpaca paper trading for ${ticket.symbol}.`);
    await onAccountRefresh();
  }

  const orderButtons = (row: MarketRow, compact = false) => {
    const symbol = paperSymbol(row.symbol);
    const hasPrice =
      row.price !== null && Number.isFinite(row.price) && row.price > 0;
    const shares =
      account?.positions.find((position) => position.symbol === symbol)?.shares ??
      0;
    const availableShares =
      shares -
      (account?.orders
        .filter(
          (order) =>
            order.cancelable &&
            order.side === "sell" &&
            order.symbol === symbol,
        )
        .reduce(
          (sum, order) =>
            sum + Math.max(0, order.qty - (order.filledQty ?? 0)),
          0,
        ) ?? 0);
    const buyingPower = account?.buyingPower ?? account?.cash ?? 0;
    const buttonClass = compact
      ? "btn btn-xs min-h-7 border-0 px-3"
      : "btn btn-xs min-h-7 border-0 px-2";
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          disabled={!account || buyingPower <= 0 || !hasPrice}
          aria-label={`Buy ${row.symbol}`}
          onClick={() => openTicket(row, "buy")}
          className={`${buttonClass} bg-success/10 text-success hover:bg-success/20`}
        >
          <ArrowUp size={12} /> Buy
        </button>
        <button
          type="button"
          disabled={!account || !hasPrice || availableShares <= 0}
          aria-label={`Sell ${row.symbol}`}
          onClick={() => openTicket(row, "sell")}
          className={`${buttonClass} bg-danger/10 text-danger hover:bg-danger/20`}
        >
          <ArrowDown size={12} /> Sell
        </button>
      </div>
    );
  };

  const columns: ColumnsType<MarketRow> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      render: (_, row) => {
        const pinned = pinnedSymbols.has(row.symbol);
        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTogglePin(row)}
              aria-label={`${pinned ? "Unpin" : "Pin"} ${row.symbol}`}
              className="text-content-muted hover:text-content focus-visible:outline focus-visible:outline-content"
            >
              {pinned ? (
                <BsFillPinAngleFill className="text-content" />
              ) : (
                <BsPinAngle />
              )}
            </button>
            {row.logo ? (
              <img
                src={row.logo}
                alt=""
                className="h-8 w-8 rounded-sm bg-elevated object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-elevated text-[11px] font-semibold text-content-secondary">
                {row.symbol.slice(0, 2)}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-ui-sm font-semibold text-opposite">
                {row.symbol}
              </div>
              <div className="text-xs text-content-secondary">{row.name}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Last 7 days",
      dataIndex: "spark",
      width: "26%",
      responsive: ["md"],
      render: (_, row) =>
        row.spark.length > 1 ? (
          <div className="pl-10 pr-4">
            <Sparkline
              data={row.spark}
              positive={(row.change ?? 0) >= 0}
              fluid
            />
          </div>
        ) : (
          <span className="text-content-muted">—</span>
        ),
    },
    {
      title: "Price",
      dataIndex: "price",
      align: "right",
      width: 130,
      render: (value: number | null) =>
        value === null ? (
          <span className="tabular-nums text-content-muted">—</span>
        ) : (
          <span className="font-semibold tabular-nums text-opposite">
            ${fmt(value, digitsFor(value))}
          </span>
        ),
    },
    {
      title: "Change",
      dataIndex: "changePct",
      align: "right",
      width: 130,
      render: (_, row) =>
        row.change === null || row.changePct === null ? (
          <span className="tabular-nums text-content-muted">—</span>
        ) : (
          <div className={`leading-tight tabular-nums ${tone(row.change)}`}>
            <div className="font-medium">{signed(row.changePct, 2, "%")}</div>
            <div className="text-xs opacity-70">
              {signed(row.change, digitsFor(row.change))}
            </div>
          </div>
        ),
    },
    {
      title: "",
      key: "action",
      align: "right",
      width: 132,
      render: (_, row) => orderButtons(row),
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-ui-base font-semibold text-opposite">Browse</h2>
      <Tabs
        items={filters}
        value={filter}
        onChange={onFilterChange}
        label={(value) =>
          value === "Pinned" ? `Pinned (${pinnedSymbols.size})` : value
        }
      />
      {filter === "Crypto" && (
        <select
          aria-label="Crypto category"
          value={cryptoSub}
          onChange={(event) => onCryptoSubChange(event.target.value)}
          className="select select-sm mt-3 w-full rounded-sm border-elevated bg-surface text-opposite sm:w-56"
        >
          {cryptoSubs.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      )}

      {symbolsLoading && (
        <p className="mt-3 text-ui-sm text-content-secondary">
          Loading market symbols…
        </p>
      )}
      <ConfigProvider theme={tableTheme}>
        <>
          <div className="mt-3 space-y-2 md:hidden">
            {mobileRows.map((row) => {
              const pinned = pinnedSymbols.has(row.symbol);
              return (
                <article
                  key={row.symbol}
                  className="rounded-xl bg-transparent p-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onTogglePin(row)}
                      aria-label={`${pinned ? "Unpin" : "Pin"} ${row.symbol}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-content-muted hover:bg-elevated hover:text-content"
                    >
                      {pinned ? (
                        <BsFillPinAngleFill className="text-content" />
                      ) : (
                        <BsPinAngle />
                      )}
                    </button>
                    {row.logo ? (
                      <img
                        src={row.logo}
                        alt=""
                        className="size-9 shrink-0 rounded-lg bg-elevated object-cover"
                      />
                    ) : (
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated text-xs font-semibold text-content-secondary">
                        {row.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-opposite">
                        {row.symbol}
                      </p>
                      <p className="truncate text-xs text-content-muted">
                        {row.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-opposite">
                        {row.price === null
                          ? "—"
                          : `$${fmt(row.price, digitsFor(row.price))}`}
                      </p>
                      <p
                        className={`text-xs tabular-nums ${row.changePct === null
                            ? "text-content-muted"
                            : tone(row.changePct)
                          }`}
                      >
                        {row.changePct === null
                          ? "—"
                          : signed(row.changePct, 2, "%")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    {orderButtons(row, true)}
                  </div>
                </article>
              );
            })}
          </div>
          {data.length === 0 && (
            <div className="rounded-xl border border-elevated bg-surface px-4 py-8 text-center text-sm text-content-muted md:hidden">
              {symbolsError
                ? "Market symbols could not be loaded. Retry to try again."
                : quotesError
                  ? "Live quotes are unavailable. Retry to try again."
                  : query
                    ? `No match for "${query}". Try a ticker like AAPL.`
                    : filter === "Pinned"
                      ? "Nothing pinned yet. Click the pin on any row to pin it."
                      : "No symbols match this filter."}
            </div>
          )}
          {pageCount > 1 && (
            <div className="flex justify-center border-t border-elevated py-4 md:hidden">
              <Pagination
                simple
                current={page}
                pageSize={PAGE_SIZE}
                total={data.length}
                showSizeChanger={false}
                onChange={onPageChange}
              />
            </div>
          )}
          <Table<MarketRow>
            className="market-browser-table mt-2 hidden md:block"
            rowKey="symbol"
            columns={columns}
            dataSource={data}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: data.length,
              showSizeChanger: false,
              onChange: onPageChange,
            }}
            tableLayout="fixed"
            rowClassName={() => "group"}
            locale={{
              emptyText: symbolsError
                ? "Market symbols could not be loaded. Retry to try again."
                : quotesError && !data.some((row) => row.price !== null)
                  ? "Live quotes are unavailable. Retry to try again."
                  : query
                    ? `No match for "${query}". Try a ticker like AAPL.`
                    : filter === "Pinned"
                      ? "Nothing pinned yet. Click the pin on any row to pin it."
                      : "No symbols match this filter.",
            }}
          />
        </>
      </ConfigProvider>
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-content shadow-xl"
        >
          {notice}
        </div>
      )}
      {ticket && (
        <MarketOrderTicket
          side={ticket.side}
          symbol={ticket.symbol}
          name={ticket.name}
          price={ticket.price}
          changePct={ticket.changePct}
          buyingPower={ticket.buyingPower}
          cash={ticket.cash}
          shares={ticket.shares}
          fractional={ticket.fractional}
          onClose={() => setTicket(null)}
          onSubmit={placeOrder}
        />
      )}
    </section>
  );
}
