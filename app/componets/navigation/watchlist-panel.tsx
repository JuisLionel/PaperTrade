"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

type Asset = { symbol: string; name: string; kind: string };

type Quote = {
  symbol: string;
  c: number | null;
  d: number | null;
  dp: number | null;
  h: number | null;
  l: number | null;
  o: number | null;
  pc: number | null;
  logo?: string | null;
  error?: string;
};

const PAGE_SIZE = 40;

const displaySymbol = (symbol: string) =>
  symbol.includes(":") ? symbol.split(":")[1].replace("USDT", "") : symbol;

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatPrice = (value: number | null | undefined) =>
  isFiniteNumber(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

export default function WatchlistPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const symbolsRequested = useRef(false);
  const quotesRequested = useRef(new Set<string>());

  useEffect(() => {
    if (!isOpen || symbolsRequested.current) return;
    symbolsRequested.current = true;

    fetch("/api/markets/symbols")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load symbols (${response.status}).`);
        }
        return response.json() as Promise<Asset[]>;
      })
      .then((list) => {
        setAssets(list);
        setSelectedSymbol((current) => current || list[0]?.symbol || "");
        setListError(null);
      })
      .catch((error: unknown) => {
        symbolsRequested.current = false;
        setListError(
          error instanceof Error ? error.message : "Could not load symbols.",
        );
      });
  }, [isOpen]);

  const filteredAssets = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return assets;
    return assets.filter(
      (asset) =>
        asset.symbol.toLowerCase().includes(search) ||
        asset.name.toLowerCase().includes(search),
    );
  }, [assets, query]);

  const visibleAssets = filteredAssets.slice(0, visibleCount);
  const visibleKey = visibleAssets.map((asset) => asset.symbol).join(",");

  useEffect(() => {
    if (!isOpen) return;

    const wanted = [...new Set([...visibleKey.split(","), selectedSymbol])]
      .filter(Boolean)
      .filter((symbol) => !quotesRequested.current.has(symbol));
    if (!wanted.length) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      wanted.forEach((symbol) => quotesRequested.current.add(symbol));
      setQuotesLoading(true);
      setQuotesError(null);

      try {
        const logoSymbols = wanted
          .filter((symbol) => !symbol.includes(":"))
          .join(",");
        const response = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(wanted.join(","))}&logos=${encodeURIComponent(logoSymbols)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Could not load market quotes (${response.status}).`);
        }

        const data = (await response.json()) as Quote[];
        setQuotes((current) => {
          const next = { ...current };
          data.forEach((quote) => {
            next[quote.symbol] = quote;
          });
          return next;
        });
      } catch (error) {
        wanted.forEach((symbol) => quotesRequested.current.delete(symbol));
        if (controller.signal.aborted) return;
        setQuotesError(
          error instanceof Error
            ? error.message
            : "Could not load market quotes.",
        );
      } finally {
        if (!controller.signal.aborted) setQuotesLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, visibleKey, selectedSymbol]);

  const selectedQuote = quotes[selectedSymbol];
  const selectedAsset = assets.find((asset) => asset.symbol === selectedSymbol);

  return (
    <div className="pointer-events-none absolute left-full top-0 z-30 h-screen w-104 max-w-[calc(100vw-13.5rem)] overflow-hidden">
      <aside
        aria-label="Watchlist"
        aria-hidden={!isOpen}
        className={`h-full w-full border-r border-line bg-surface transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${
          isOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-full opacity-0"
        }`}
      >
        <div className="flex h-screen min-h-160 w-full flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 className="text-sm font-semibold text-content">Markets</h2>
            <button
              type="button"
              aria-label="Close watchlist"
              onClick={onClose}
              className="rounded p-1.5 text-content-muted hover:bg-elevated hover:text-content"
            >
              <FiX size={17} />
            </button>
          </div>

          <div className="border-b border-line px-3 py-2">
            <div className="relative">
              <FiSearch
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder={
                  assets.length
                    ? `Search ${assets.length.toLocaleString()} symbols…`
                    : "Loading symbols…"
                }
                className="w-full rounded-md border border-line bg-base py-1.5 pl-8 pr-3 text-xs text-content placeholder:text-content-muted focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(7rem,1.3fr)_1fr_0.8fr_0.8fr] gap-2 border-b border-line px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-content-muted">
            <span>Symbol</span>
            <span className="text-right">Last</span>
            <span className="text-right">Change</span>
            <span className="text-right">Chg%</span>
          </div>

          <div className="hide-scrollbar min-h-0 flex-[1.4] overflow-y-auto">
            {listError && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {listError}
              </p>
            )}
            {quotesError && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {quotesError}
              </p>
            )}

            {visibleAssets.map((asset) => {
              const quote = quotes[asset.symbol];
              const selected = asset.symbol === selectedSymbol;
              const positive = isFiniteNumber(quote?.d) && quote.d >= 0;
              const hasData =
                quote && !quote.error && isFiniteNumber(quote.c) && quote.c > 0;

              return (
                <button
                  type="button"
                  key={asset.symbol}
                  onClick={() => setSelectedSymbol(asset.symbol)}
                  className={`grid w-full grid-cols-[minmax(7rem,1.3fr)_1fr_0.8fr_0.8fr] items-center gap-2 border-b border-line/60 px-3 py-2.5 text-left transition-colors ${
                    selected ? "bg-elevated" : "hover:bg-elevated/60"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {quote?.logo ? (
                      <Image
                        src={quote.logo}
                        alt=""
                        width={20}
                        height={20}
                        unoptimized
                        className="size-5 shrink-0 rounded-full bg-white object-contain"
                      />
                    ) : (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-content-secondary">
                        {asset.kind === "Crypto" ? "₿" : asset.symbol.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-content-secondary">
                        {displaySymbol(asset.symbol)}
                      </span>
                      <span className="block truncate text-[10px] text-content-muted">
                        {asset.name}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-xs text-content-secondary">
                    {hasData ? formatPrice(quote.c) : "—"}
                  </span>
                  <span
                    className={`text-right text-xs ${positive ? "text-success" : "text-danger"}`}
                  >
                    {hasData ? formatPrice(quote.d) : "—"}
                  </span>
                  <span
                    className={`text-right text-xs ${positive ? "text-success" : "text-danger"}`}
                  >
                    {hasData && isFiniteNumber(quote.dp)
                      ? `${quote.dp.toFixed(2)}%`
                      : "—"}
                  </span>
                </button>
              );
            })}

            {quotesLoading && (
              <p className="px-4 py-2 text-xs text-content-muted">
                Loading quotes…
              </p>
            )}

            {visibleCount < filteredAssets.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="w-full px-4 py-3 text-xs text-content-secondary hover:bg-elevated/60"
              >
                Show more (
                {(filteredAssets.length - visibleCount).toLocaleString()}{" "}
                remaining)
              </button>
            )}

            {assets.length > 0 && !filteredAssets.length && (
              <p className="px-4 py-3 text-xs text-content-muted">
                No symbols match “{query}”.
              </p>
            )}
          </div>

          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-line bg-base px-4 py-5">
            {selectedAsset && (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {selectedQuote?.logo ? (
                      <Image
                        src={selectedQuote.logo}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="size-9 rounded-lg bg-white object-contain"
                      />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-content">
                        {selectedAsset.kind === "Crypto"
                          ? "₿"
                          : selectedAsset.symbol.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-content">
                        {displaySymbol(selectedAsset.symbol)}
                      </h3>
                      <p className="text-xs text-content-muted">
                        {selectedAsset.name}
                      </p>
                    </div>
                  </div>
                  <span className="rounded border border-line px-2 py-1 text-[10px] text-content-muted">
                    {selectedAsset.kind}
                  </span>
                </div>

                {selectedQuote?.error ? (
                  <p role="alert" className="mt-5 text-xs text-danger">
                    {selectedQuote.error}
                  </p>
                ) : selectedQuote &&
                  isFiniteNumber(selectedQuote.c) &&
                  selectedQuote.c > 0 ? (
                  <>
                    <div className="mt-6">
                      <p className="text-2xl font-semibold tabular-nums text-content">
                        {formatPrice(selectedQuote.c)}
                        <span className="ml-1 text-xs font-normal text-content-muted">
                          USD
                        </span>
                      </p>
                      <p
                        className={`mt-1 text-sm tabular-nums ${
                          isFiniteNumber(selectedQuote.d) && selectedQuote.d >= 0
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {isFiniteNumber(selectedQuote.d) && selectedQuote.d >= 0
                          ? "+"
                          : ""}
                        {formatPrice(selectedQuote.d)} (
                        {isFiniteNumber(selectedQuote.dp)
                          ? `${selectedQuote.dp.toFixed(2)}%`
                          : "—"}
                        )
                      </p>
                    </div>

                    <div className="mt-7">
                      <div className="mb-2 flex justify-between text-[10px] uppercase tracking-wide text-content-muted">
                        <span>Day range</span>
                        <span>Open {formatPrice(selectedQuote.o)}</span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-elevated">
                        <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-content-secondary/60" />
                      </div>
                      <div className="mt-2 flex justify-between text-xs tabular-nums text-content-secondary">
                        <span>{formatPrice(selectedQuote.l)}</span>
                        <span>{formatPrice(selectedQuote.h)}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-line bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wide text-content-muted">
                          Previous close
                        </p>
                        <p className="mt-1 text-sm tabular-nums text-content">
                          {formatPrice(selectedQuote.pc)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wide text-content-muted">
                          Market
                        </p>
                        <p className="mt-1 text-sm text-content">
                          {selectedAsset.kind}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-5 text-xs text-content-muted">
                    {quotesLoading
                      ? "Loading quote…"
                      : selectedQuote
                        ? "Quote data is unavailable for this symbol."
                        : "Select an asset to view its quote."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
