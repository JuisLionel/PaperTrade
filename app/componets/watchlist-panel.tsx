"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi";
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
  readPinnedAssets,
  writePinnedAssets,
} from "@/lib/client/watchlist-storage";
import {
  CRYPTO_CATEGORIES,
  getCryptoCategory,
} from "@/lib/crypto-categories";

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
const GAINERS_CATEGORY = "gainers";
const LOSERS_CATEGORY = "losers";
const CRYPTO_CATEGORY = "crypto";
const ALL_CRYPTO = "all-crypto";

const toSet = (symbols: string) => new Set(symbols.split(/\s+/).filter(Boolean));
const isCryptoAsset = (asset: Asset) =>
  asset.kind.toLowerCase().includes("crypto");

// Static sector map. Add tickers to any list to extend a sector.
const SECTORS = [
  {
    id: "tech",
    label: "Tech",
    symbols: toSet(`
      AAPL MSFT NVDA AVGO ORCL CRM ADBE AMD INTC CSCO QCOM TXN IBM NOW INTU
      AMAT MU LRCX KLAC ADI PANW SNPS CDNS ANET ACN FTNT HPQ DELL NXPI MCHP
      ON ROP MSI APH TEL GLW WDC STX NTAP JNPR KEYS FSLR ENPH SMCI PLTR
    `),
  },
  {
    id: "comm",
    label: "Comm",
    symbols: toSet(`
      GOOGL GOOG META NFLX DIS CMCSA T VZ TMUS CHTR EA TTWO WBD PARA FOX
      FOXA OMC IPG LYV MTCH
    `),
  },
  {
    id: "finance",
    label: "Finance",
    symbols: toSet(`
      JPM BAC WFC C GS MS BLK SCHW AXP V MA PYPL COF USB PNC TFC BK AFL MET
      PRU AIG TRV CB ALL PGR MMC AON SPGI MCO ICE CME BRK.B BRK-B FITB HBAN
      KEY RF CFG NTRS STT DFS SYF AJG MSCI NDAQ CBOE
    `),
  },
  {
    id: "health",
    label: "Health",
    symbols: toSet(`
      UNH JNJ LLY PFE MRK ABBV ABT TMO DHR BMY AMGN GILD CVS CI ELV HUM MDT
      ISRG SYK BSX VRTX REGN ZTS BDX A MRNA HCA IQV IDXX EW DXCM BIIB MCK
      CAH COR HOLX ZBH RMD WAT MTD
    `),
  },
  {
    id: "energy",
    label: "Energy",
    symbols: toSet(`
      XOM CVX COP EOG SLB OXY PSX MPC VLO WMB KMI OKE HAL BKR DVN FANG HES
      CTRA APA TRGP EQT
    `),
  },
  {
    id: "consumer",
    label: "Consumer",
    symbols: toSet(`
      AMZN TSLA HD MCD NKE SBUX LOW TGT COST WMT PG KO PEP PM MO MDLZ CL KMB
      BKNG MAR HLT ABNB GM F LULU TJX ROST ORLY AZO YUM CMG DG DLTR KHC GIS
      HSY STZ KDP EL KR SYY
    `),
  },
  {
    id: "industrials",
    label: "Industrials",
    symbols: toSet(`
      CAT DE BA HON GE RTX LMT NOC UPS FDX UNP CSX NSC MMM ETN EMR ITW WM GD
      PH CMI PCAR ROK FAST CTAS RSG LHX TDG URI DAL UAL LUV
    `),
  },
];

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
  const box = size === 20 ? "w-5" : "w-9";
  return logo ? (
    <div className="avatar">
      <div className={`${box} rounded-full bg-white`}>
        <Image
          src={logo}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="object-contain"
        />
      </div>
    </div>
  ) : (
    <div className="avatar avatar-placeholder">
      <div
        className={`${box} rounded-full bg-neutral text-neutral-content ${size === 20 ? "text-[9px]" : "text-sm font-bold"
          }`}
      >
        <span>{fallback}</span>
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
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startScroll: 0, moved: false });
  const [tabsDragging, setTabsDragging] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEscapeFocus(searchRef);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sp500Assets, setSp500Assets] = useState<Asset[]>([]);
  const [cryptoAssets, setCryptoAssets] = useState<Asset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
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
    if (!isOpen || category !== SP500_CATEGORY || sp500Requested.current) return;
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
      { id: GAINERS_CATEGORY, label: "Gainers" },
      { id: LOSERS_CATEGORY, label: "Losers" },
      ...sectorTabs,
      { id: CRYPTO_CATEGORY, label: "Crypto" },
    ];
  }, [assets, pinnedAssets]);

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
    const changeOf = (asset: Asset) => {
      const dp = quotes[asset.symbol]?.dp;
      return isFiniteNumber(dp) ? dp : null;
    };

    const result = [...uniqueAssets.values()]
      .filter((asset) => {
        switch (category) {
          case ALL_CATEGORY:
            return true;
          case PINNED_CATEGORY:
            return pinnedSet.has(asset.symbol);
          case SP500_CATEGORY:
            return sp500Set.has(asset.symbol);
          case GAINERS_CATEGORY:
            return (changeOf(asset) ?? 0) > 0;
          case LOSERS_CATEGORY:
            return (changeOf(asset) ?? 0) < 0;
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

    if (category === GAINERS_CATEGORY) {
      return result.sort((a, b) => (changeOf(b) ?? 0) - (changeOf(a) ?? 0));
    }
    if (category === LOSERS_CATEGORY) {
      return result.sort((a, b) => (changeOf(a) ?? 0) - (changeOf(b) ?? 0));
    }
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
    quotes,
    searchLoadedFor,
    searchResults,
    sp500Assets,
    sp500Set,
  ]);

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

  return (
    <div className="pointer-events-none absolute left-full top-0 z-30 h-screen w-104 max-w-[calc(100vw-13.5rem)] overflow-hidden">
      <aside
        aria-label="Watchlist"
        aria-hidden={!isOpen}
        className={`h-full w-full border-r border-border bg-base transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen
          ? "pointer-events-auto translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-full opacity-0"
          }`}
      >
        <div className="flex h-screen min-h-160 w-full flex-col">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <h2 className="text-sm font-semibold text-content">US markets</h2>
            <button
              type="button"
              aria-label="Close watchlist"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-square bg-surface hover:bg-"
            >
              <FiX size={17} />
            </button>
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

          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Watchlist categories"
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse") return;
              const el = tabsRef.current;
              if (!el) return;
              dragRef.current = {
                startX: event.clientX,
                startScroll: el.scrollLeft,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              if (event.pointerType !== "mouse" || event.buttons !== 1) return;
              const el = tabsRef.current;
              if (!el) return;
              const dx = event.clientX - dragRef.current.startX;
              if (Math.abs(dx) > 5 && !dragRef.current.moved) {
                dragRef.current.moved = true;
                setTabsDragging(true);
              }
              if (dragRef.current.moved) {
                el.scrollLeft = dragRef.current.startScroll - dx;
              }
            }}
            onPointerUp={() => setTabsDragging(false)}
            onPointerLeave={() => setTabsDragging(false)}
            onClickCapture={(event) => {
              if (dragRef.current.moved) {
                event.preventDefault();
                event.stopPropagation();
                dragRef.current.moved = false;
              }
            }}
            className={`hide-scrollbar carousel carousel-center w-full shrink-0 select-none gap-0 px-2 py-1 ${tabsDragging
              ? "snap-none cursor-grabbing"
              : "cursor-grab"
              }`}
          >
            {categoryTabs.map((tab) => (
              <div key={tab.id} className="carousel-item basis-1/5 min-w-0 px-1">
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
                  className={`w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-1 py-1.5 text-center text-xs font-normal transition-colors duration-200 ease-out ${category === tab.id
                    ? "bg-elevated text-content"
                    : "text-content-muted hover:bg-elevated hover:text-content"
                    }`}
                >
                  {tab.label}
                </button>
              </div>
            ))}
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
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="btn btn-ghost btn-sm btn-block rounded-none text-xs font-normal text-content-secondary"
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
          <div className="flex items-center justify-between border-t border-border px-2 py-2 text-xl font-bold text-content-muted">
            <button type="button" className="btn w-49 bg-success hover:bg-success/80">
              Buy
            </button>
            <button type="button" className="btn w-49 bg-danger hover:bg-danger/80">
              Sell
            </button>
          </div>
        </div>
      </aside >
    </div >
  );
}