"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Position, Series } from "@/types/trading";
import {
  calculateHoldings,
  errorMessage,
  filterAssets,
  indexList,
  PAGE_SIZE,
  rowFromAsset,
  type Filter,
  type IndexKey,
  type MarketRow,
  type Range,
} from "../(Routes)/markets/market-types";

const QUOTE_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

type UseMarketDataParams = {
  query: string;
  filter: Filter;
  cryptoSub: string;
  range: Range;
  page: number;
  positions: Position[];
};

export function useMarketData({
  query,
  filter,
  cryptoSub,
  range,
  page,
  positions,
}: UseMarketDataParams) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cryptoAssets, setCryptoAssets] = useState<Asset[]>([]);
  const [sp500Assets, setSp500Assets] = useState<Asset[]>([]);
  const [pinnedAssets, setPinnedAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [history, setHistory] = useState<Record<string, Series>>({});
  const [historyLoadedKey, setHistoryLoadedKey] = useState<string | null>(null);
  const [indexQuotes, setIndexQuotes] = useState<
    Partial<Record<IndexKey, Quote>>
  >({});
  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const pinnedSymbols = useMemo(
    () => new Set(pinnedAssets.map((asset) => asset.symbol)),
    [pinnedAssets],
  );
  const sp500Symbols = useMemo(
    () => new Set(sp500Assets.map((asset) => asset.symbol)),
    [sp500Assets],
  );
  const holdingKey = positions.map((position) => position.symbol).join(",");

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
    ).then((results) => {
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

  const candidates = useMemo(
    () =>
      filterAssets(
        assets,
        cryptoAssets,
        sp500Assets,
        pinnedAssets,
        filter,
        cryptoSub,
        query,
      ),
    [assets, cryptoAssets, cryptoSub, filter, pinnedAssets, query, sp500Assets],
  );
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
  const historyKey = visibleRows
    .filter((row) => !row.symbol.includes(":"))
    .map((row) => row.symbol)
    .join(",");

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

  const holdings = useMemo(
    () => calculateHoldings(positions, quotes),
    [positions, quotes],
  );

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

  return {
    data,
    holdings,
    history,
    historyError,
    historyLoadedKey,
    historyKey,
    indexError,
    indexQuotes,
    pinError,
    pinnedSymbols,
    quotes,
    quotesError,
    retry,
    sp500Symbols,
    symbolsError,
    symbolsLoading,
    togglePin,
  };
}
