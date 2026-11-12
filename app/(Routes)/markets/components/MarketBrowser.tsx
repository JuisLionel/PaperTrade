"use client";

import { ConfigProvider, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BsFillPinAngleFill, BsPinAngle } from "react-icons/bs";
import Sparkline from "@/app/(Routes)/markets/components/Sparkline";
import { Tabs } from "@/app/componets/ui/Tabs";
import { digitsFor, fmt, signed, tone } from "@/lib/format";
import {
  cryptoSubs,
  filters,
  PAGE_SIZE,
  type Filter,
  type MarketRow,
} from "../market-types";

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
}: MarketBrowserProps) {
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
                className="h-8 w-8 rounded-sm bg-elevated object-contain p-1"
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
      title: "",
      key: "action",
      align: "right",
      width: 96,
      render: () => (
        <button className="btn btn-sm rounded-sm border-0 bg-content text-base opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
          Trade
        </button>
      ),
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
        <Table<MarketRow>
          className="market-browser-table mt-2"
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
                    : filter === "Gainers" || filter === "Losers"
                      ? "No S&P 500 movers are available yet."
                      : "No symbols match this filter.",
          }}
        />
      </ConfigProvider>
    </section>
  );
}
