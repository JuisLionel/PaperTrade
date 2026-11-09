"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfigProvider, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FiSearch } from "react-icons/fi";
import { BsFillPinAngleFill, BsPinAngle } from "react-icons/bs";

import { useAccount } from "@/app/Hooks/useAccount";
import Sparkline from "@/app/componets/markets/Sparkline";
import IndexChart from "@/app/componets/markets/IndexChart";
import { Tabs } from "@/app/componets/ui/Tabs";
import {
  getCryptoSymbols,
  getMarketIndexQuote,
  getMarketQuotes,
  getMarketSymbols,
  getSp500Symbols,
  type Asset,
  type Quote,
} from "@/lib/client/markets";
import {
  PINNED_ASSETS_CHANGED_EVENT,
  readPinnedAssets,
  writePinnedAssets,
} from "@/lib/client/watchlist-storage";
import {
  CRYPTO_CATEGORIES,
  getCryptoCategory,
} from "@/lib/crypto-categories";
import { digitsFor, fmt, signed, tone } from "@/lib/format";
import {
  getMarketSector,
} from "@/lib/market-sectors";
import type { Position, Series } from "@/types/trading";

const categories = [
  "Tech",
  "Comm",
  "Finance",
  "Health",
  "Energy",
  "Consumer",
  "Industrials",
  "Other",
  "Crypto",
] as const;
type Category = (typeof categories)[number];
const cryptoSubs = [
  "All crypto",
  ...CRYPTO_CATEGORIES.map((category) => category.label),
];
type Filter = "All" | "Pinned" | "S&P 500" | "Gainers" | "Losers" | Category;
type Range = "1D" | "5D" | "1M";
type IndexKey = "sp500" | "nasdaq" | "dow" | "russell";
type MarketRow = {
  symbol: string;
  name: string;
  category: Category;
  sp500: boolean;
  kind: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  logo: string | null;
  spark: number[];
};

const filters: Filter[] = [
  "All",
  "Pinned",
  "S&P 500",
  "Gainers",
  "Losers",
  ...categories,
];
const ranges: Range[] = ["1D", "5D", "1M"];
const indexList: { key: IndexKey; name: string; proxy: string }[] = [
  { key: "sp500", name: "S&P 500", proxy: "SPY" },
  { key: "nasdaq", name: "Nasdaq", proxy: "QQQ" },
  { key: "dow", name: "Dow Jones", proxy: "DIA" },
  { key: "russell", name: "Russell 2000", proxy: "IWM" },
];
const QUOTE_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;
const PAGE_SIZE = 10;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";
const isCrypto = (asset: Asset) =>
  asset.kind.toLowerCase().includes("crypto") || asset.symbol.includes(":");
const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

function rowFromAsset(
  asset: Asset,
  sp500Symbols: Set<string>,
  quotes: Map<string, Quote>,
  history: Record<string, Series>,
): MarketRow {
  const quote = quotes.get(asset.symbol);
  const category: Category = isCrypto(asset)
    ? "Crypto"
    : getMarketSector(asset.symbol);

  return {
    symbol: asset.symbol,
    name: asset.name,
    category,
    sp500: sp500Symbols.has(asset.symbol),
    kind: asset.kind,
    price: quote?.c ?? null,
    change: quote?.d ?? null,
    changePct: quote?.dp ?? null,
    volume: null,
    logo: quote?.logo ?? null,
    spark: history[asset.symbol]?.c ?? [],
  };
}

function getRangeSeries(series: Series | undefined, range: Range) {
  if (!series || series.c.length < 2) return [];
  if (range === "1D") return series.c;
  return series.c.slice(range === "5D" ? -6 : -22);
}

function seriesChange(series: number[]) {
  const first = series[0];
  const last = series[series.length - 1];
  return first && last ? ((last - first) / first) * 100 : null;
}

const money = (n: number) => `${n >= 0 ? "+" : "-"}$${fmt(Math.abs(n))}`;

export default function Market() {
  const account = useAccount();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [cryptoSub, setCryptoSub] = useState("All crypto");
  const [range, setRange] = useState<Range>("1D");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cryptoAssets, setCryptoAssets] = useState<Asset[]>([]);
  const [sp500Assets, setSp500Assets] = useState<Asset[]>([]);
  const [pinnedAssets, setPinnedAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [history, setHistory] = useState<Record<string, Series>>({});
  const [historyLoadedKey, setHistoryLoadedKey] = useState<string | null>(null);
  const [indexQuotes, setIndexQuotes] = useState<Partial<Record<IndexKey, Quote>>>({});
  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const browseRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const pinnedSymbols = useMemo(
    () => new Set(pinnedAssets.map((asset) => asset.symbol)),
    [pinnedAssets],
  );
  const sp500Symbols = useMemo(
    () => new Set(sp500Assets.map((asset) => asset.symbol)),
    [sp500Assets],
  );
  const holdingKey =
    account?.positions.map((position) => position.symbol).join(",") ?? "";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getMarketSymbols(controller.signal),
      getCryptoSymbols(controller.signal),
      getSp500Symbols(controller.signal),
    ])
      .then(([marketList, cryptoList, sp500List]) => {
        setAssets(marketList);
        setCryptoAssets(cryptoList);
        setSp500Assets(sp500List);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSymbolsError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSymbolsLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const syncPins = () => {
      try {
        setPinnedAssets(readPinnedAssets());
        setPinError(null);
      } catch (error) {
        setPinError(errorMessage(error));
      }
    };
    const onPinsChanged = (event: Event) => {
      const detail = (event as CustomEvent<Asset[]>).detail;
      setPinnedAssets(detail);
      setPinError(null);
    };
    void Promise.resolve().then(syncPins);
    window.addEventListener(PINNED_ASSETS_CHANGED_EVENT, onPinsChanged);
    return () =>
      window.removeEventListener(PINNED_ASSETS_CHANGED_EVENT, onPinsChanged);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled(
      indexList.map(async ({ key }) => [
        key,
        await getMarketIndexQuote(key, controller.signal),
      ] as const),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const loaded = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        const failed = results
          .filter((result) => result.status === "rejected")
          .map((result) =>
            result.status === "rejected" ? errorMessage(result.reason) : "",
          );
        setIndexQuotes(
          Object.fromEntries(loaded) as Partial<Record<IndexKey, Quote>>,
        );
        setIndexError(failed.length ? failed.join(" ") : null);
      });
    return () => controller.abort();
  }, [refresh]);

  const candidates = useMemo(() => {
    const search = query.trim().toLowerCase();
    const allAssets = [
      ...new Map(
        [...assets, ...cryptoAssets].map((asset) => [asset.symbol, asset]),
      ).values(),
    ];
    let rows: Asset[];

    switch (filter) {
      case "All":
        rows = allAssets.filter((asset) => !isCrypto(asset));
        break;
      case "Pinned":
        rows = pinnedAssets;
        break;
      case "S&P 500":
        rows = sp500Assets;
        break;
      case "Gainers":
      case "Losers":
        rows = sp500Assets.slice(0, 50);
        break;
      case "Crypto":
        rows = allAssets.filter(isCrypto);
        if (cryptoSub !== "All crypto") {
          rows = rows.filter(
            (asset) =>
              CRYPTO_CATEGORIES.find(
                (category) => category.id === getCryptoCategory(asset.symbol),
              )?.label === cryptoSub,
          );
        }
        break;
      default:
        rows = allAssets.filter(
          (asset) =>
            !isCrypto(asset) && getMarketSector(asset.symbol) === filter,
        );
    }

    return rows.filter(
      (asset) =>
        !search ||
        asset.symbol.toLowerCase().includes(search) ||
        asset.name.toLowerCase().includes(search),
    );
  }, [
    assets,
    cryptoAssets,
    cryptoSub,
    filter,
    pinnedAssets,
    query,
    sp500Assets,
  ]);
  const candidateKey = candidates.map((asset) => asset.symbol).join(",");

  useEffect(() => {
    if (symbolsLoading) return;
    const controller = new AbortController();
    const candidateSymbols = candidateKey ? candidateKey.split(",") : [];
    const symbols =
      filter === "Gainers" || filter === "Losers"
        ? candidateSymbols
        : candidateSymbols.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const holdingSymbols = holdingKey ? holdingKey.split(",") : [];
    const requested = [...new Set([...symbols, ...holdingSymbols])];
    if (!requested.length) return;

    const logoSymbols = new Set([...symbols, ...holdingSymbols]);
    (async () => {
      try {
        for (let start = 0; start < requested.length; start += QUOTE_BATCH_SIZE) {
          if (start > 0) await wait(BATCH_DELAY_MS);
          const batch = requested.slice(start, start + QUOTE_BATCH_SIZE);
          const result = await getMarketQuotes(
            batch,
            batch.filter((symbol) => logoSymbols.has(symbol)),
            controller.signal,
          );
          setQuotes((current) => {
            const next = new Map(current);
            result.quotes.forEach((quote) => next.set(quote.symbol, quote));
            return next;
          });
          if (result.status === 429) {
            throw new Error(
              `Market data is rate limited. Try again in ${result.retryAfter ?? "60"} seconds.`,
            );
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setQuotesError(errorMessage(error));
      }
    })();
    return () => controller.abort();
  }, [candidateKey, filter, holdingKey, page, refresh, symbolsLoading]);

  const candidateRows = useMemo(
    () =>
      candidates.map((asset) =>
        rowFromAsset(asset, sp500Symbols, quotes, history),
      ),
    [candidates, history, quotes, sp500Symbols],
  );
  const data = useMemo(() => {
    const movers =
      filter === "Gainers"
        ? candidateRows.filter((row) => row.change !== null && row.change > 0)
        : filter === "Losers"
          ? candidateRows.filter((row) => row.change !== null && row.change < 0)
          : candidateRows;
    if (filter === "Gainers") {
      return [...movers].sort(
        (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
      );
    }
    if (filter === "Losers") {
      return [...movers].sort(
        (a, b) => (a.changePct ?? Infinity) - (b.changePct ?? Infinity),
      );
    }
    return movers;
  }, [candidateRows, filter]);
  const visibleRows = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const historySymbols = visibleRows
    .filter((row) => !row.symbol.includes(":"))
    .map((row) => row.symbol);
  const historyKey = historySymbols.join(",");

  useEffect(() => {
    if (symbolsLoading) return;
    const controller = new AbortController();
    const symbols = [
      ...new Set([
        "SPY",
        "QQQ",
        "DIA",
        "IWM",
        ...historyKey.split(",").filter(Boolean),
      ]),
    ];
    (async () => {
      try {
        for (let start = 0; start < symbols.length; start += QUOTE_BATCH_SIZE) {
          if (start > 0) await wait(BATCH_DELAY_MS);
          const batch = symbols.slice(start, start + QUOTE_BATCH_SIZE);
          const interval = range === "1D" ? "15min" : "1day";
          const response = await fetch(
            `/api/candles?symbols=${encodeURIComponent(batch.join(","))}&interval=${interval}`,
            { signal: controller.signal },
          );
          if (!response.ok) {
            throw new Error(
              `Could not load market history (${response.status}).`,
            );
          }
          const result = (await response.json()) as {
            series?: Record<string, Series>;
          };
          if (!result.series) {
            throw new Error("Market history response is invalid.");
          }
          setHistory((current) => ({ ...current, ...result.series }));
        }
      } catch (error) {
        if (!controller.signal.aborted) setHistoryError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) {
          setHistoryLoadedKey(`${range}:${historyKey}`);
        }
      }
    })();
    return () => controller.abort();
  }, [historyKey, range, refresh, symbolsLoading]);

  const togglePin = (row: MarketRow) => {
    const next = pinnedSymbols.has(row.symbol)
      ? pinnedAssets.filter((asset) => asset.symbol !== row.symbol)
      : [...pinnedAssets, { symbol: row.symbol, name: row.name, kind: row.kind }];
    try {
      writePinnedAssets(next);
      setPinError(null);
    } catch (error) {
      setPinError(errorMessage(error));
    }
  };

  const openBrowse = (next: Filter) => {
    setPage(1);
    setFilter(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    browseRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const holdings = useMemo(() => {
    const positions = account?.positions ?? [];
    let value = 0;
    let cost = 0;
    let day = 0;
    let priced = 0;

    const rows = positions.map((position) => {
      const quote = quotes.get(position.symbol);
      const price = quote?.c ?? null;
      const rowValue = price === null ? null : position.shares * price;
      cost += position.shares * position.avgCost;
      if (rowValue !== null) {
        value += rowValue;
        day += position.shares * (quote?.d ?? 0);
        priced += 1;
      }
      return { position, value: rowValue };
    });

    rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

    return {
      rows,
      value,
      day,
      cost,
      ret: value - cost,
      // totals are only trustworthy once every position has a live price
      complete: positions.length > 0 && priced === positions.length,
    };
  }, [account, quotes]);

  const columns: ColumnsType<MarketRow> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      render: (_, row) => {
        const pinned = pinnedSymbols.has(row.symbol);
        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => togglePin(row)}
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
      title: "Volume",
      dataIndex: "volume",
      align: "right",
      width: 120,
      responsive: ["md"],
      render: () => <span className="text-content-muted">—</span>,
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
        <button className="btn btn-sm rounded-sm border-0 bg-content text-[color:var(--color-base)] opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
          Trade
        </button>
      ),
    },
  ];

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

  const sp500Quote = indexQuotes.sp500;
  const sp500History = getRangeSeries(history.SPY, range);
  const chartData =
    sp500History.length > 1 && sp500Quote?.c
      ? sp500History.map(
        (value) => (value / sp500History[sp500History.length - 1]) * sp500Quote.c!,
      )
      : [];
  const changePct =
    range === "1D"
      ? sp500Quote?.dp ?? null
      : seriesChange(sp500History);

  const retry = () => {
    setQuotes(new Map());
    setHistory({});
    setHistoryLoadedKey(null);
    setIndexQuotes({});
    setSymbolsLoading(true);
    setSymbolsError(null);
    setQuotesError(null);
    setHistoryError(null);
    setIndexError(null);
    setRefresh((current) => current + 1);
  };

  return (
    <main className="min-h-screen bg-base px-6 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-ui-xl font-bold text-opposite">
          Markets
        </h1>
        <label className="input input-sm h-9 w-full rounded-sm border-elevated bg-surface sm:w-72">
          <FiSearch className="text-content-muted" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search symbol or company"
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
          />
          <kbd className="kbd kbd-sm border-0 bg-elevated text-content-secondary">
            /
          </kbd>
        </label>
      </header>

      <section className="mb-8 grid overflow-hidden rounded-md border border-elevated bg-surface lg:grid-cols-[2fr_1fr]">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-ui-sm text-content-secondary">S&P 500</div>
              <div className="font-display text-4xl font-bold tabular-nums text-opposite">
                {sp500Quote?.c != null ? fmt(sp500Quote.c) : "—"}
              </div>
              <div
                className={`text-ui-sm font-medium tabular-nums ${changePct === null ? "text-content-muted" : tone(changePct)}`}
              >
                {changePct === null ? "—" : signed(changePct, 2, "%")}{" "}
                <span className="font-normal text-content-muted">
                  {range === "1D" ? "today" : `past ${range}`}
                </span>
              </div>
            </div>
            <Tabs items={ranges} value={range} onChange={setRange} />
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

        <ul className="flex flex-col divide-y divide-elevated border-t border-elevated lg:border-t-0 lg:border-l">
          {indexList.map((index) => {
            const quote = indexQuotes[index.key];
            const indexHistory = getRangeSeries(history[index.proxy], range);
            return (
              <li
                key={index.key}
                className="flex flex-1 items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="text-ui-sm text-content-secondary">
                    {index.name}
                  </div>
                  <div className="font-display text-ui-lg font-semibold tabular-nums text-opposite">
                    {quote?.c != null ? fmt(quote.c) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-ui-sm font-medium tabular-nums ${quote?.dp == null ? "text-content-muted" : tone(quote.dp)}`}
                  >
                    {quote?.dp == null ? "—" : signed(quote.dp, 2, "%")}
                  </span>
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
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {(symbolsError || quotesError || indexError || pinError) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-ui-sm text-danger">
          <p>
            {[symbolsError, quotesError, indexError, pinError]
              .filter(Boolean)
              .join(" ")}
          </p>
          <button
            type="button"
            onClick={retry}
            className="btn btn-sm rounded-sm border-elevated bg-surface text-opposite"
          >
            Retry
          </button>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-ui-base font-semibold text-opposite">My holdings</h2>
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
              {pinnedSymbols.size > 0 && (
                <button
                  type="button"
                  onClick={() => openBrowse("Pinned")}
                  className="btn btn-sm rounded-sm border-elevated bg-surface text-opposite"
                >
                  View pinned ({pinnedSymbols.size})
                </button>
              )}
              <button
                type="button"
                onClick={() => openBrowse("S&P 500")}
                className="btn btn-sm rounded-sm border-0 bg-content text-[color:var(--color-base)]"
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

            <ConfigProvider
              theme={{
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
              }}
            >
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

      <section>
        <h2 className="mb-3 text-ui-base font-semibold text-opposite">Browse</h2>
        <Tabs
          items={filters}
          value={filter}
          onChange={(value) => {
            setPage(1);
            setFilter(value);
          }}
          label={(value) =>
            value === "Pinned" ? `Pinned (${pinnedSymbols.size})` : value
          }
        />
        {filter === "Crypto" && (
          <select
            aria-label="Crypto category"
            value={cryptoSub}
            onChange={(event) => {
              setPage(1);
              setCryptoSub(event.target.value);
            }}
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
        <ConfigProvider
          theme={{
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
          }}
        >
          <Table<MarketRow>
            className="mt-2"
            rowKey="symbol"
            columns={columns}
            dataSource={data}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: data.length,
              showSizeChanger: false,
              onChange: setPage,
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
    </main>
  );
}
