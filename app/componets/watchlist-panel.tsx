"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { LuX } from "react-icons/lu";
import { BsFillPinAngleFill } from "react-icons/bs";
import useEscapeFocus from "../Hooks/useEscapeFocus";
import {
  getCryptoSymbols,
  getMarketQuotes,
  getMarketSymbols,
  getSp500Symbols,
  MarketApiError,
  searchMarketSymbols,
  type Asset,
  type Quote,
} from "@/lib/client/markets";
import {
  PINNED_ASSETS_CHANGED_EVENT,
  savePinnedAssets,
  syncPinnedAssets,
} from "@/lib/client/watchlist-storage";
import {
  CRYPTO_CATEGORIES,
  getCryptoCategory,
} from "@/lib/crypto-categories";
import { MARKET_SECTORS as SECTORS } from "@/lib/market-sectors";

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

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

const signed = (value: number | null | undefined) =>
  isFiniteNumber(value) ? `${value >= 0 ? "+" : ""}${formatPrice(value)}` : "—";

const signedPct = (value: number | null | undefined) =>
  isFiniteNumber(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—";

// daisyUI semantic colors: success / error
const tone = (value: number | null | undefined) =>
  isFiniteNumber(value) && value >= 0 ? "text-success" : "text-error";

/* ───────── Categories ───────── */

const ALL_CATEGORY = "all";
const PINNED_CATEGORY = "pinned";
const SP500_CATEGORY = "sp500";
const CRYPTO_CATEGORY = "crypto";
const ALL_CRYPTO = "all-crypto";

const isCryptoAsset = (asset: Asset) =>
  asset.kind.toLowerCase().includes("crypto");

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

function LogoAvatar({
  logo,
  fallback,
  size,
}: {
  logo?: string | null;
  fallback: string;
  size: 20 | 36;
}) {
  const box = size === 20 ? "size-5" : "size-9";
  return logo ? (
    <div className="shrink-0">
      <div className={`relative ${box} overflow-hidden rounded-sm bg-white`}>
        <Image
          src={logo}
          alt=""
          fill
          sizes={`${size}px`}
          unoptimized
          className="object-cover"
        />
      </div>
    </div>
  ) : (
    <div className="shrink-0">
      <div
        className={`${box} flex items-center justify-center rounded-sm bg-neutral text-neutral-content ${size === 20 ? "text-[9px]" : "text-sm font-bold"
          }`}
      >
        {fallback}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  sub,
  valueClassName,
}: {
  title: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-content-muted">
        {title}
      </dt>
      <dd
        className={`text-sm tabular-nums ${valueClassName ?? "text-content-secondary"
          }`}
      >
        {value}
        {sub && <span className="ml-1 text-[10px] opacity-80">{sub}</span>}
      </dd>
    </div>
  );
}

export default function WatchlistPanel({
  isOpen,
  onClose,
  mobile = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  mobile?: boolean;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabDragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressTabClickRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEscapeFocus(searchRef);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sp500Assets, setSp500Assets] = useState<Asset[]>([]);
  const [cryptoAssets, setCryptoAssets] = useState<Asset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(
    mobile ? PINNED_CATEGORY : ALL_CATEGORY,
  );
  const [cryptoCategory, setCryptoCategory] = useState<string>(ALL_CRYPTO);
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
  const sp500Requested = useRef(false);
  const cryptoRequested = useRef(false);
  const quotesRequested = useRef(new Set<string>());
  const logosRequested = useRef(new Set<string>());

  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  useEffect(() => {
    let active = true;
    const handlePinsChanged = (event: Event) => {
      setPinnedAssets((event as CustomEvent<Asset[]>).detail);
    };
    void syncPinnedAssets()
      .then((savedPins) => {
        if (active) setPinnedAssets(savedPins);
      })
      .catch((error: unknown) => {
        console.error("Failed to sync Alpaca watchlist pins:", error);
        if (active) {
          setPinError(
            error instanceof Error
              ? error.message
              : "Alpaca watchlist pins could not be loaded.",
          );
        }
      });
    window.addEventListener(PINNED_ASSETS_CHANGED_EVENT, handlePinsChanged);
    return () => {
      active = false;
      window.removeEventListener(
        PINNED_ASSETS_CHANGED_EVENT,
        handlePinsChanged,
      );
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

  // All: every US symbol Finnhub has (S&P 500 first)
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

  // S&P 500: loaded the first time its tab opens
  useEffect(() => {
    if (
      !isOpen ||
      category !== SP500_CATEGORY ||
      sp500Requested.current
    ) {
      return;
    }
    sp500Requested.current = true;

    getSp500Symbols()
      .then((list) => {
        setSp500Assets(list);
        setListError(null);
      })
      .catch((error: unknown) => {
        sp500Requested.current = false;
        setListError(
          error instanceof Error
            ? error.message
            : "Could not load S&P 500 symbols.",
        );
      });
  }, [isOpen, category]);

  useEffect(() => {
    if (
      !isOpen ||
      (category !== CRYPTO_CATEGORY && category !== ALL_CATEGORY) ||
      cryptoRequested.current
    ) {
      return;
    }
    cryptoRequested.current = true;

    getCryptoSymbols()
      .then((list) => {
        setCryptoAssets(list);
        if (category === CRYPTO_CATEGORY && list.length) {
          setSelectedSymbol(list[0].symbol);
          setSelectedAsset(list[0]);
        }
        setListError(null);
      })
      .catch((error: unknown) => {
        cryptoRequested.current = false;
        setListError(
          error instanceof Error
            ? error.message
            : "Could not load crypto symbols.",
        );
      });
  }, [isOpen, category]);

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

  const sp500Set = useMemo(
    () => new Set(sp500Assets.map((asset) => asset.symbol)),
    [sp500Assets],
  );

  // Only show sector tabs that have at least one matching symbol.
  const categoryTabs = useMemo(() => {
    const everything = [...assets, ...pinnedAssets];
    const sectorTabs = SECTORS.filter((sector) =>
      everything.some((asset) => sector.symbols.has(asset.symbol)),
    ).map((sector) => ({ id: sector.id, label: sector.label }));

    return [
      { id: ALL_CATEGORY, label: "All" },
      {
        id: PINNED_CATEGORY,
        label: `Pinned${pinnedAssets.length ? ` (${pinnedAssets.length})` : ""}`,
      },
      { id: SP500_CATEGORY, label: "S&P 500" },
      ...sectorTabs,
      { id: CRYPTO_CATEGORY, label: "Crypto" },
    ];
  }, [assets, pinnedAssets]);

  const startTabDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    tabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTabDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = tabDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
    }
  };

  const stopTabDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = tabDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressTabClickRef.current = drag.moved;
    tabDragRef.current = null;
  };

  const preventTabClickAfterDrag = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!suppressTabClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressTabClickRef.current = false;
  };

  const filteredAssets = useMemo(() => {
    const search = query.trim();

    let candidates: Asset[];
    if (search) {
      candidates =
        searchLoadedFor === search
          ? [...pinnedAssets, ...searchResults]
          : [];
    } else if (category === CRYPTO_CATEGORY) {
      candidates = [...pinnedAssets, ...cryptoAssets];
    } else if (category === SP500_CATEGORY) {
      candidates = sp500Assets;
    } else {
      candidates = [...pinnedAssets, ...assets, ...cryptoAssets];
    }

    const normalizedSearch = search.toLowerCase();
    const uniqueAssets = new Map<string, Asset>();
    candidates.forEach((asset) => uniqueAssets.set(asset.symbol, asset));

    const sector = SECTORS.find((item) => item.id === category);

    const result = [...uniqueAssets.values()]
      .filter((asset) => {
        switch (category) {
          case ALL_CATEGORY:
            return true;
          case PINNED_CATEGORY:
            return pinnedSet.has(asset.symbol);
          case SP500_CATEGORY:
            return sp500Set.has(asset.symbol);
          case CRYPTO_CATEGORY:
            return (
              isCryptoAsset(asset) &&
              (cryptoCategory === ALL_CRYPTO ||
                getCryptoCategory(asset.symbol) === cryptoCategory)
            );
          default:
            return sector ? sector.symbols.has(asset.symbol) : true;
        }
      })
      .filter(
        (asset) =>
          !normalizedSearch ||
          asset.symbol.toLowerCase().includes(normalizedSearch) ||
          asset.name.toLowerCase().includes(normalizedSearch),
      );

    return result.sort(
      (a, b) => Number(pinnedSet.has(b.symbol)) - Number(pinnedSet.has(a.symbol)),
    );
  }, [
    assets,
    category,
    cryptoAssets,
    cryptoCategory,
    pinnedAssets,
    pinnedSet,
    query,
    searchLoadedFor,
    searchResults,
    sp500Assets,
    sp500Set,
  ]);

  const togglePinned = async (asset: Asset) => {
    try {
      const current = await syncPinnedAssets(true);
      const next = current.some(
        (pinnedAsset) => pinnedAsset.symbol === asset.symbol,
      )
        ? current.filter((pinnedAsset) => pinnedAsset.symbol !== asset.symbol)
        : [...current, asset];
      const saved = await savePinnedAssets(next);
      setPinnedAssets(saved);
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
        !symbol.includes(":") &&
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

  const details = useMemo(() => {
    const q = selectedQuote;
    if (!q || q.error || !isFiniteNumber(q.c) || q.c <= 0) return null;

    const { c, o, h, l, pc, t } = q;
    const bounds =
      isFiniteNumber(h) && isFiniteNumber(l) && h > l ? { h, l } : null;
    const span = bounds ? bounds.h - bounds.l : null;

    return {
      rangePct:
        bounds && span ? clampPct(((c - bounds.l) / span) * 100) : 50,
      openPct:
        bounds && span && isFiniteNumber(o)
          ? clampPct(((o - bounds.l) / span) * 100)
          : null,
      rangeSpread: span,
      rangeSpreadPct: bounds && span ? (span / bounds.l) * 100 : null,
      fromOpen: isFiniteNumber(o) ? c - o : null,
      fromOpenPct: isFiniteNumber(o) && o > 0 ? ((c - o) / o) * 100 : null,
      gapPct:
        isFiniteNumber(o) && isFiniteNumber(pc) && pc > 0
          ? ((o - pc) / pc) * 100
          : null,
      updatedAt:
        isFiniteNumber(t) && t > 0
          ? new Date(t * 1000).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          : null,
    };
  }, [selectedQuote]);

  const emptyMessage = `We couldn't find anything matching “${query}”.`
  const panelOpen = isOpen;

  return (
    <div
      className={
        mobile
          ? "h-full w-full overflow-hidden"
          : "pointer-events-none absolute left-full top-0 z-30 h-screen w-104 max-w-[calc(100vw-13.5rem)] overflow-hidden"
      }
    >
      <aside
        aria-label="Watchlist"
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        className={`h-full w-full border-r border-border bg-base ${
          mobile
            ? ""
            : `transition-[translate] duration-200 ease-in-out motion-reduce:transition-none ${
                panelOpen
                  ? "pointer-events-auto translate-x-0"
                  : "pointer-events-none -translate-x-full"
              }`
        }`}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-content">US markets</h2>
            </div>
            {mobile ? (
              <Button
                type="text"
                aria-label="Close watchlist"
                icon={<LuX size={24} aria-hidden />}
                onClick={onClose}
                className="!flex !size-10 !items-center !justify-center !rounded-full !p-0 !text-content-secondary hover:!bg-elevated hover:!text-content"
              />
            ) : (
              <Button
                type="text"
                aria-label="Close watchlist"
                icon={<LuX aria-hidden />}
                onClick={onClose}
                className="!flex !size-9 !items-center !justify-center !rounded-full !p-0 !text-content-secondary hover:!bg-elevated hover:!text-content"
              />
            )}
          </div>

          {/* Search */}
          <div className="px-2 pt-3 pb-2">
            <label className="group/input input input-sm w-full border-border bg-surface text-content focus-within:border-content focus-within:outline-none! focus-within:shadow-none!">
              <FiSearch size={14} className="text-content-muted" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                aria-label="Search markets"
                onChange={(event) => {
                  const search = event.target.value;
                  setQuery(search);
                  setVisibleCount(PAGE_SIZE);
                  setSearchLoading(
                    Boolean(search.trim()) && rateLimitSeconds === 0,
                  );
                  setSearchError(null);
                }}
                placeholder={assets.length ? "Search" : "Loading Data..."}
                className="grow text-xs placeholder:text-content-muted"
              />
              {searchLoading && query.trim() ? (
                <span className="loading loading-spinner loading-xs text-content-muted" />
              ) : (
                <kbd className="kbd kbd-xs hidden sm:inline-flex">ESC</kbd>
              )}
            </label>

            {rateLimitSeconds > 0 && query.trim() && (
              <p role="status" className="px-1 pt-2 text-xs text-content-muted">
                Search is rate-limited. Retrying in {rateLimitSeconds} seconds.
              </p>
            )}
          </div>

          <div className="w-full shrink-0 px-2 py-1">
            <div
              ref={tabsRef}
              role="tablist"
              aria-label="Watchlist categories"
              onPointerDown={startTabDrag}
              onPointerMove={moveTabDrag}
              onPointerUp={stopTabDrag}
              onPointerCancel={stopTabDrag}
              onClickCapture={preventTabClickAfterDrag}
              className="hide-scrollbar flex min-w-0 touch-pan-x snap-x snap-mandatory cursor-grab select-none gap-0 overflow-x-auto active:cursor-grabbing"
            >
              {categoryTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="w-1/3 shrink-0 snap-start px-1 sm:w-1/4"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={category === tab.id}
                    title={tab.label}
                    onClick={(event) => {
                      setCategory(tab.id);
                      setCryptoCategory(ALL_CRYPTO);
                      setVisibleCount(PAGE_SIZE);
                      if (tab.id === CRYPTO_CATEGORY && cryptoAssets.length) {
                        setSelectedSymbol(cryptoAssets[0].symbol);
                        setSelectedAsset(cryptoAssets[0]);
                      }
                      event.currentTarget.scrollIntoView({
                        behavior: "smooth",
                        inline: "center",
                        block: "nearest",
                      });
                    }}
                    className={`w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-1 py-1.5 text-center text-xs font-normal transition-colors duration-200 ease-out ${
                      category === tab.id
                        ? "bg-elevated text-content"
                        : "text-content-muted hover:bg-elevated hover:text-content"
                    }`}
                  >
                    {tab.label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {category === CRYPTO_CATEGORY && (
            <div className="relative z-20 shrink-0 px-2 py-1 w-full">
              <details className="dropdown relative block w-full">
                <summary className="flex h-8 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md bg-elevated px-3 text-xs text-content">
                  {cryptoCategory === ALL_CRYPTO
                    ? "All crypto"
                    : CRYPTO_CATEGORIES.find((item) => item.id === cryptoCategory)
                      ?.label ?? "All crypto"}
                  <FiChevronDown size={14} />
                </summary>
                <ul className="dropdown-content menu menu-sm absolute left-0 top-full mt-1 w-full gap-y-1 rounded-md border border-border bg-base p-1 shadow-none">
                  {[{ id: ALL_CRYPTO, label: "All crypto" }, ...CRYPTO_CATEGORIES].map(
                    (item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={cryptoCategory === item.id}
                          className={`${cryptoCategory === item.id ?
                            "bg-elevated! text-content!" :
                            "text-content-secondary hover:bg-elevated! hover:text-content!"
                            }`}
                          onClick={(event) => {
                            setCryptoCategory(item.id);
                            setVisibleCount(PAGE_SIZE);
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                          }}
                        >
                          {item.label}
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </details>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[minmax(8.5rem,1.3fr)_1.5rem_1fr_0.8fr_0.8fr] gap-2 border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-content-muted">
            <span>Symbol</span>
            <span aria-hidden="true" />
            <span className="text-right">Last</span>
            <span className="text-right">Change</span>
            <span className="text-right">Chg%</span>
          </div>

          {/* List */}
          <div className="hide-scrollbar min-h-0 flex-[1.4] overflow-y-auto">
            <div className="flex flex-col gap-2 px-3 empty:hidden">
              {[listError, pinError, quotesError, searchError]
                .filter((message): message is string => Boolean(message))
                .map((message) => (
                  <div
                    key={message}
                    role="alert"
                    className="alert alert-error alert-soft mt-2 py-2 text-xs"
                  >
                    <span>{message}</span>
                  </div>
                ))}
              {rateLimitSeconds > 0 && (
                <div
                  role="status"
                  className="alert alert-warning alert-soft mt-2 py-2 text-xs"
                >
                  <span>
                    Rate limit reached. New quotes are paused for about{" "}
                    {rateLimitSeconds} seconds; loaded quotes are unchanged.
                  </span>
                </div>
              )}
            </div>

            {visibleAssets.map((asset) => {
              const quote = quotes[asset.symbol];
              const selected = asset.symbol === selectedSymbol;
              const hasData =
                quote && !quote.error && isFiniteNumber(quote.c) && quote.c > 0;
              const isPending = !hasData && loadingSymbols.has(asset.symbol);
              const pinned = pinnedSet.has(asset.symbol);
              const changeTone = tone(quote?.d);
              const selectAsset = () => {
                setSelectedSymbol(asset.symbol);
                setSelectedAsset(asset);
              };
              return (
                <div
                  key={asset.symbol}
                  className={`grid grid-cols-[minmax(8.5rem,1.3fr)_1.5rem_1fr_0.8fr_0.8fr] items-center gap-2 border-b border-border px-3 py-2.5 ${selected ? "bg-elevated" : "hover:bg-elevated"
                    }`}
                >
                  <button
                    type="button"
                    aria-label={`Select ${displaySymbol(asset.symbol)}`}
                    aria-pressed={selected}
                    onClick={selectAsset}
                    className="btn btn-ghost col-span-full row-start-1 grid h-auto min-h-0 w-full grid-cols-[minmax(8.5rem,1.3fr)_1.5rem_1fr_0.8fr_0.8fr] justify-normal gap-2 rounded-none border-0 !bg-transparent p-0 text-left text-content-secondary shadow-none outline-none normal-case focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-content"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <LogoAvatar
                        logo={quote?.logo}
                        size={20}
                        fallback={
                          isCryptoAsset(asset) ? "₿" : asset.symbol.slice(0, 1)
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-content-secondary">
                          {displaySymbol(asset.symbol)}
                        </span>
                        <span className="block truncate text-[10px] text-content-muted">
                          {asset.name}
                        </span>
                      </span>
                    </span>
                    <span aria-hidden="true" />
                    <span className="text-right text-xs text-content-secondary">
                      {hasData ? (
                        formatPrice(quote.c)
                      ) : isPending ? (
                        <span className="skeleton ml-auto block h-3 w-12" />
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className={`text-right text-xs ${changeTone}`}>
                      {hasData ? (
                        formatPrice(quote.d)
                      ) : isPending ? (
                        <span className="skeleton ml-auto block h-3 w-8" />
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className={`text-right text-xs ${changeTone}`}>
                      {hasData && isFiniteNumber(quote.dp) ? (
                        `${quote.dp.toFixed(2)}%`
                      ) : isPending ? (
                        <span className="skeleton ml-auto block h-3 w-8" />
                      ) : (
                        "—"
                      )}
                    </span>
                  </button>
                  <div
                    className="tooltip tooltip-left col-start-2 row-start-1 z-10 justify-self-center"
                    data-tip={pinned ? "Unpin" : "Pin"}
                  >
                    <button
                      type="button"
                      aria-label={`${pinned ? "Unpin" : "Pin"} ${displaySymbol(asset.symbol)}`}
                      aria-pressed={pinned}
                      onClick={() => togglePinned(asset)}
                      className={`btn btn-ghost btn-xs btn-square ${pinned ? "text-success" : "text-content-secondary"
                        }`}
                    >
                      <BsFillPinAngleFill size={14} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })}

            {quotesLoading && rateLimitSeconds === 0 && (
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-content-muted">
                <span className="loading loading-spinner loading-xs" />
                Loading quotes…
              </div>
            )}

            {visibleCount < filteredAssets.length && (
              <button
                type="button"
                disabled={quotesLoading}
                onClick={() => {
                  setVisibleCount((count) => count + PAGE_SIZE);
                }}
                className="btn btn-ghost btn-sm btn-block rounded-none text-xs font-normal text-content-secondary"
              >
                {`Show more (${(
                  filteredAssets.length - visibleCount
                ).toLocaleString()} remaining)`}
              </button>
            )}

            {!searchLoading &&
              !searchError &&
              !filteredAssets.length &&
              ((!query.trim() && assets.length > 0) ||
                (query.trim() && searchLoadedFor === query.trim())) && (
                <p className="px-4 py-3 text-xs text-content-muted">
                  {emptyMessage}
                </p>
              )}
          </div>

          {/* ───────── Detail section ───────── */}
          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-border bg-base px-4 py-5">
            {selectedAsset && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LogoAvatar
                      logo={selectedQuote?.logo}
                      size={36}
                      fallback={
                        isCryptoAsset(selectedAsset)
                          ? "₿"
                          : selectedAsset.symbol.slice(0, 1)
                      }
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-content">
                        {displaySymbol(selectedAsset.symbol)}
                      </h3>
                      <p className="text-xs text-content-muted">
                        {selectedAsset.name}
                      </p>
                    </div>
                  </div>
                  <span className="py-1 border-border border-2 px-2 text-xs text-content-muted rounded-[5px]">
                    {selectedAsset.kind}
                  </span>
                </div>

                {selectedQuote?.error ? (
                  <div
                    role="alert"
                    className="alert alert-error alert-soft mt-5 py-2 text-xs"
                  >
                    <span>{selectedQuote.error}</span>
                  </div>
                ) : selectedQuote && details ? (
                  <>
                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-2xl font-semibold tabular-nums text-content">
                          {formatPrice(selectedQuote.c)}
                          <span className="ml-1 text-xs font-normal text-content-muted">
                            USD
                          </span>
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`badge badge-soft badge-sm tabular-nums ${isFiniteNumber(selectedQuote.d) && selectedQuote.d >= 0
                              ? "badge-success"
                              : "badge-error"
                              }`}
                          >
                            {signedPct(selectedQuote.dp)}
                          </span>
                          <span
                            className={`text-sm tabular-nums ${tone(selectedQuote.d)}`}
                          >
                            {signed(selectedQuote.d)}
                          </span>
                        </div>
                      </div>
                      {details.updatedAt && (
                        <p className="mt-2 text-[10px] text-content-muted">
                          Last update {details.updatedAt}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 flex justify-between text-[10px] uppercase tracking-wide text-content-muted">
                        <span>Day range</span>
                        {details.rangeSpreadPct !== null && (
                          <span>Spread {details.rangeSpreadPct.toFixed(2)}%</span>
                        )}
                      </div>

                      <div className="relative mx-1.5">
                        <progress
                          className="progress progress-success block h-1.5 w-full bg-elevated"
                          value={details.rangePct}
                          max={100}
                          aria-label="Last price position within the day range"
                        />
                        {details.openPct !== null && (
                          <span
                            title="Open"
                            className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-content-muted"
                            style={{ left: `${details.openPct}%` }}
                          />
                        )}
                        <span
                          title="Last"
                          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success"
                          style={{ left: `${details.rangePct}%` }}
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-xs tabular-nums text-content-secondary">
                        <span>
                          <span className="mr-1 text-[10px] text-content-muted">
                            Low
                          </span>
                          {formatPrice(selectedQuote.l)}
                        </span>
                        <span>
                          <span className="mr-1 text-[10px] text-content-muted">
                            High
                          </span>
                          {formatPrice(selectedQuote.h)}
                        </span>
                      </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4">
                      <Stat title="Open" value={formatPrice(selectedQuote.o)} />
                      <Stat
                        title="Prev close"
                        value={formatPrice(selectedQuote.pc)}
                      />
                      <Stat
                        title="Since open"
                        value={signed(details.fromOpen)}
                        sub={
                          isFiniteNumber(details.fromOpenPct)
                            ? signedPct(details.fromOpenPct)
                            : undefined
                        }
                        valueClassName={tone(details.fromOpen)}
                      />
                      <Stat
                        title="Gap vs prev close"
                        value={signedPct(details.gapPct)}
                        valueClassName={tone(details.gapPct)}
                      />
                      <Stat
                        title="Day swing"
                        value={formatPrice(details.rangeSpread)}
                      />
                      <Stat title="Type" value={selectedAsset.kind} />
                    </dl>
                  </>
                ) : loadingSymbols.has(selectedSymbol) ? (
                  <div className="mt-5 flex items-center gap-2 text-xs text-content-muted">
                    <span className="loading loading-spinner loading-xs" />
                    {rateLimitSeconds > 0
                      ? "Waiting for the rate-limit cooldown…"
                      : "Loading quote…"}
                  </div>
                ) : (
                  <p className="mt-5 text-xs text-content-muted">
                    {selectedQuote
                      ? "Quote data is unavailable for this symbol."
                      : "Select an asset to view its quote."}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-2 py-2 text-xl font-bold">
            <button type="button" className="btn w-49 bg-success hover:bg-success/80 text-white">
              Buy
            </button>
            <button type="button" className="btn w-49 bg-danger hover:bg-danger/80 text-white">
              Sell
            </button>
          </div>
        </div>
      </aside >
    </div >
  );
}