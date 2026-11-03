"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { BsFillPinAngleFill } from "react-icons/bs";
import {
  getMarketQuotes,
  getMarketSymbols,
  MarketApiError,
  searchMarketSymbols,
  type Asset,
  type Quote,
} from "@/lib/client/markets";
import {
  readPinnedAssets,
  writePinnedAssets,
} from "@/lib/client/watchlist-storage";

const PAGE_SIZE = 10;
const QUOTE_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

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

function getRateLimitSeconds(retryAfter: string | null) {
  const retrySeconds = retryAfter ? Number(retryAfter) : NaN;
  const retryDateSeconds = retryAfter
    ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000)
    : NaN;
  const cooldownSeconds =
    Number.isFinite(retrySeconds) && retrySeconds > 0
      ? retrySeconds
      : Number.isFinite(retryDateSeconds) && retryDateSeconds > 0
        ? retryDateSeconds
        : 60;

  return Math.max(60, Math.ceil(cooldownSeconds));
}

export default function WatchlistPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [searchLoadedFor, setSearchLoadedFor] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(new Set<string>());
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinnedAssets, setPinnedAssets] = useState<Asset[]>([]);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const quotesRef = useRef(quotes);
  const symbolsRequested = useRef(false);
  const quotesRequested = useRef(new Set<string>());
  const logosRequested = useRef(new Set<string>());

  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      try {
        const savedPins = readPinnedAssets();
        writePinnedAssets(savedPins);
        if (active) {
          setPinnedAssets(savedPins);
        }
      } catch (error) {
        console.error("Failed to load saved watchlist pins:", error);
        if (active) setPinError("Saved pins could not be loaded.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(
      () => setRateLimitSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  useEffect(() => {
    if (!isOpen || symbolsRequested.current) return;
    symbolsRequested.current = true;

    getMarketSymbols()
      .then((list) => {
        setAssets(list);
        setSelectedSymbol((current) => current || list[0]?.symbol || "");
        setSelectedAsset((current) => current ?? list[0] ?? null);
        setListError(null);
      })
      .catch((error: unknown) => {
        symbolsRequested.current = false;
        setListError(
          error instanceof Error ? error.message : "Could not load symbols.",
        );
      });
  }, [isOpen]);

  useEffect(() => {
    const search = query.trim();
    if (!search || rateLimitSeconds > 0) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchLoading(true);
      searchMarketSymbols(search, controller.signal)
        .then((results) => {
          setSearchResults(results);
          setSearchLoadedFor(search);
          setSearchError(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (error instanceof MarketApiError && error.status === 429) {
            setRateLimitSeconds(getRateLimitSeconds(error.retryAfter));
            setSearchError(null);
            return;
          }
          setSearchError(
            error instanceof Error ? error.message : "Could not search symbols.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, rateLimitSeconds]);

  const pinnedSet = useMemo(
    () => new Set(pinnedAssets.map((asset) => asset.symbol)),
    [pinnedAssets],
  );

  const filteredAssets = useMemo(() => {
    const search = query.trim();
    const candidates = search
      ? searchLoadedFor === search
        ? [...pinnedAssets, ...searchResults]
        : []
      : [...pinnedAssets, ...assets];
    const normalizedSearch = search.toLowerCase();
    const uniqueAssets = new Map<string, Asset>();
    candidates.forEach((asset) => uniqueAssets.set(asset.symbol, asset));

    return [...uniqueAssets.values()]
      .filter(
        (asset) =>
          !normalizedSearch ||
          asset.symbol.toLowerCase().includes(normalizedSearch) ||
          asset.name.toLowerCase().includes(normalizedSearch),
      )
      .sort(
        (a, b) => Number(pinnedSet.has(b.symbol)) - Number(pinnedSet.has(a.symbol)),
      );
  }, [assets, pinnedAssets, pinnedSet, query, searchLoadedFor, searchResults]);

  const togglePinned = (asset: Asset) => {
    const next = pinnedSet.has(asset.symbol)
      ? pinnedAssets.filter((pinnedAsset) => pinnedAsset.symbol !== asset.symbol)
      : [...pinnedAssets, asset];

    try {
      writePinnedAssets(next);
      setPinnedAssets(next);
      setPinError(null);
    } catch (error) {
      console.error("Failed to save watchlist pins:", error);
      setPinError(
        error instanceof Error
          ? error.message
          : "Saved pins could not be updated.",
      );
    }
  };

  const visibleAssets = useMemo(
    () => filteredAssets.slice(0, visibleCount),
    [filteredAssets, visibleCount],
  );
  const visibleKey = visibleAssets.map((asset) => asset.symbol).join(",");

  useEffect(() => {
    if (!isOpen) return;

    if (rateLimitSeconds > 0) return;

    const candidates = [...new Set([...visibleKey.split(","), selectedSymbol])]
      .filter(Boolean);
    const assetsBySymbol = new Map(visibleAssets.map((asset) => [asset.symbol, asset]));
    if (selectedAsset) assetsBySymbol.set(selectedAsset.symbol, selectedAsset);
    const needsLogo = (symbol: string) => {
      const asset = assetsBySymbol.get(symbol);
      return (
        asset?.kind !== "Crypto" &&
        !quotesRef.current[symbol]?.logo &&
        !logosRequested.current.has(symbol)
      );
    };
    const wanted = candidates.filter(
      (symbol) =>
        !quotesRequested.current.has(symbol) || needsLogo(symbol),
    );
    if (!wanted.length) return;

    const controller = new AbortController();
    const settled = new Set<string>();
    const requestedQuotes = quotesRequested.current;
    const requestedLogos = logosRequested.current;
    const timer = setTimeout(async () => {
      wanted.forEach((symbol) => {
        setLoadingSymbols((current) => new Set(current).add(symbol));
      });
      setQuotesLoading(true);
      setQuotesError(null);

      try {
        for (let index = 0; index < wanted.length; index += QUOTE_BATCH_SIZE) {
          if (index > 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, BATCH_DELAY_MS);
            });
          }
          if (controller.signal.aborted) return;

          const batch = wanted.slice(index, index + QUOTE_BATCH_SIZE);
          batch.forEach((symbol) => quotesRequested.current.add(symbol));
          const logoSymbols = batch.filter(needsLogo);
          logoSymbols.forEach((symbol) => requestedLogos.add(symbol));

          const {
            quotes: data,
            status,
            retryAfter,
          } = await getMarketQuotes(batch, logoSymbols, controller.signal);
          const limited = data.filter((quote) => quote.rateLimited);
          const completed = data.filter((quote) => !quote.rateLimited);

          setQuotes((current) => {
            const next = { ...current };
            data.forEach((quote) => {
              if (quote.error) {
                if (!next[quote.symbol]) next[quote.symbol] = quote;
                return;
              }
              const hasFreshQuote =
                isFiniteNumber(quote.c) && quote.c > 0;
              if (hasFreshQuote || quote.logo) {
                const previous = next[quote.symbol];
                next[quote.symbol] = {
                  ...previous,
                  ...(hasFreshQuote ? quote : {}),
                  logo: quote.logo ?? previous?.logo ?? null,
                  error: undefined,
                  rateLimited: undefined,
                };
              }
            });
            return next;
          });

          completed.forEach((quote) => {
            settled.add(quote.symbol);
            setLoadingSymbols((current) => {
              const next = new Set(current);
              next.delete(quote.symbol);
              return next;
            });
          });

          const limitedWithQuote = limited.filter((quote) =>
            isFiniteNumber(quote.c),
          );
          limitedWithQuote.forEach((quote) => {
            settled.add(quote.symbol);
            setLoadingSymbols((current) => {
              const next = new Set(current);
              next.delete(quote.symbol);
              return next;
            });
          });

          if (limited.length || status === 429) {
            limited.forEach((quote) => {
              requestedLogos.delete(quote.symbol);
              if (!isFiniteNumber(quote.c)) {
                quotesRequested.current.delete(quote.symbol);
              }
            });

            setRateLimitSeconds(getRateLimitSeconds(retryAfter));
            setSearchLoading(false);
            return;
          }

          completed.forEach((quote) => settled.add(quote.symbol));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        wanted
          .filter((symbol) => !settled.has(symbol))
          .forEach((symbol) => {
            requestedQuotes.delete(symbol);
            requestedLogos.delete(symbol);
          });
        setLoadingSymbols((current) => {
          const next = new Set(current);
          wanted
            .filter((symbol) => !settled.has(symbol))
            .forEach((symbol) => next.delete(symbol));
          return next;
        });
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
      wanted
        .filter((symbol) => !settled.has(symbol))
        .forEach((symbol) => {
          requestedQuotes.delete(symbol);
          requestedLogos.delete(symbol);
        });
    };
  }, [assets, isOpen, rateLimitSeconds, selectedAsset, selectedSymbol, visibleAssets, visibleKey]);

  const selectedQuote = quotes[selectedSymbol];

  return (
    <div className="pointer-events-none absolute left-full top-0 z-30 h-screen w-104 max-w-[calc(100vw-13.5rem)] overflow-hidden">
      <aside
        aria-label="Watchlist"
        aria-hidden={!isOpen}
        className={`h-full w-full border-r border-line bg-surface transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-full opacity-0"
          }`}
      >
        <div className="flex h-screen min-h-160 w-full flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 className="text-sm font-semibold text-content">US markets</h2>
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
                  const search = event.target.value;
                  setQuery(search);
                  setVisibleCount(PAGE_SIZE);
                  setSearchLoading(
                    Boolean(search.trim()) && rateLimitSeconds === 0,
                  );
                  setSearchError(null);
                }}
                placeholder={
                  assets.length
                    ? "Search"
                    : "Loading Data..."
                }
                className="w-full rounded-md border border-line bg-base py-1.5 pl-8 pr-3 text-xs text-content placeholder:text-content-muted focus:outline-none"
              />
            </div>
            {rateLimitSeconds > 0 && query.trim() && (
              <p role="status" className="px-1 pt-2 text-xs text-content-muted">
                Search is rate-limited. Retrying in {rateLimitSeconds} seconds.
              </p>
            )}
          </div>

          <div className="grid grid-cols-[minmax(8.5rem,1.3fr)_1fr_0.8fr_0.8fr] gap-2 border-b border-line px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-content-muted">
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
            {pinError && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {pinError}
              </p>
            )}
            {quotesError && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {quotesError}
              </p>
            )}
            {searchError && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {searchError}
              </p>
            )}
            {searchLoading && query.trim() && (
              <p role="status" className="px-4 py-2 text-xs text-content-muted">
                Searching all US listings…
              </p>
            )}
            {rateLimitSeconds > 0 && (
              <p
                role="status"
                className="px-4 py-2 text-xs text-content-muted"
              >
                Finnhub rate limit reached. New quotes are paused for about{" "}
                {rateLimitSeconds} seconds;
                loaded quotes are unchanged.
              </p>
            )}

            {visibleAssets.map((asset) => {
              const quote = quotes[asset.symbol];
              const selected = asset.symbol === selectedSymbol;
              const positive = isFiniteNumber(quote?.d) && quote.d >= 0;
              const hasData =
                quote && !quote.error && isFiniteNumber(quote.c) && quote.c > 0;
              const isPending = !hasData && loadingSymbols.has(asset.symbol);

              const pinned = pinnedSet.has(asset.symbol);
              const selectAsset = () => {
                setSelectedSymbol(asset.symbol);
                setSelectedAsset(asset);
              };
              const cellClassName = `text-right text-xs text-content-secondary ${selected ? "bg-elevated" : "hover:bg-elevated/60"
                }`;

              return (
                <div
                  key={asset.symbol}
                  className={`grid grid-cols-[minmax(8.5rem,1.3fr)_1fr_0.8fr_0.8fr] items-center gap-2 border-b border-line/60 px-3 py-2.5 ${selected ? "bg-elevated" : "hover:bg-elevated/60"
                    }`}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={selectAsset}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded text-left ${selected ? "text-content" : "hover:text-content"
                        }`}
                    >
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
                    </button>
                    <button
                      type="button"
                      aria-label={`${pinned ? "Unpin" : "Pin"} ${displaySymbol(asset.symbol)}`}
                      aria-pressed={pinned}
                      title={`${pinned ? "Unpin" : "Pin"} ${displaySymbol(asset.symbol)}`}
                      onClick={() => togglePinned(asset)}
                      className={`shrink-0 rounded p-1 transition-colors ${pinned
                          ? "text-success hover:bg-elevated"
                          : "text-content-muted hover:bg-elevated hover:text-content"
                        }`}
                    >
                      <BsFillPinAngleFill
                        size={14}
                        fill={pinned ? "currentColor" : "white"}
                      />
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={`Select ${displaySymbol(asset.symbol)}`}
                    onClick={selectAsset}
                    className={cellClassName}
                  >
                    {hasData ? (
                      formatPrice(quote.c)
                    ) : isPending ? (
                      <span className="ml-auto block h-3 w-12 animate-pulse rounded bg-elevated" />
                    ) : (
                      "—"
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Select ${displaySymbol(asset.symbol)}`}
                    onClick={selectAsset}
                    className={`text-right text-xs ${positive ? "text-success" : "text-danger"
                      } ${selected ? "bg-elevated" : "hover:bg-elevated/60"}`}
                  >
                    {hasData ? (
                      formatPrice(quote.d)
                    ) : isPending ? (
                      <span className="ml-auto block h-3 w-8 animate-pulse rounded bg-elevated" />
                    ) : (
                      "—"
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Select ${displaySymbol(asset.symbol)}`}
                    onClick={selectAsset}
                    className={`text-right text-xs ${positive ? "text-success" : "text-danger"
                      } ${selected ? "bg-elevated" : "hover:bg-elevated/60"}`}
                  >
                    {hasData && isFiniteNumber(quote.dp)
                      ? `${quote.dp.toFixed(2)}%`
                      : isPending
                        ? <span className="ml-auto block h-3 w-8 animate-pulse rounded bg-elevated" />
                        : "—"}
                  </button>
                </div>
              );
            })}

            {quotesLoading && rateLimitSeconds === 0 && (
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

            {!searchLoading &&
              !searchError &&
              !filteredAssets.length &&
              ((!query.trim() && assets.length > 0) ||
                (query.trim() && searchLoadedFor === query.trim())) && (
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
                        className={`mt-1 text-sm tabular-nums ${isFiniteNumber(selectedQuote.d) && selectedQuote.d >= 0
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
                    {loadingSymbols.has(selectedSymbol)
                      ? rateLimitSeconds > 0
                        ? "Waiting for Finnhub’s rate-limit cooldown…"
                        : "Loading quote…"
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
