"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  Clock3,
  LayoutDashboard,
  Newspaper,
  X,
  Star,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Button } from "antd";
import {
  getMarketQuotes,
  type Asset,
  type Quote,
} from "@/lib/client/markets";
import {
  OPEN_WATCHLIST_EVENT,
  PINNED_ASSETS_CHANGED_EVENT,
  readPinnedAssets,
  syncPinnedAssets,
} from "@/lib/client/watchlist-storage";
import WatchlistPanel from "../watchlist-panel";

const suggestedAssets: Asset[] = [
  { symbol: "AAPL", name: "Apple Inc.", kind: "Stock" },
  { symbol: "MSFT", name: "Microsoft Corp.", kind: "Stock" },
  { symbol: "NVDA", name: "NVIDIA Corp.", kind: "Stock" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", kind: "Stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", kind: "Stock" },
];

const navigationLinks = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Markets", href: "/markets", icon: Activity },
  { name: "News", href: "/news", icon: Newspaper },
  { name: "Portfolio", href: "/portfolio", icon: BriefcaseBusiness },
  { name: "Watchlist", href: "/watchlist", icon: Star },
  { name: "Orders & activity", href: "/orders", icon: Clock3 },
] as const;

const formatPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : "—";

export default function Sidebar({
  mobile = false,
  onNavigate,
  watchlistRequest = 0,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  watchlistRequest?: number;
}) {
  const pathname = usePathname();
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isMobileWatchlistView, setIsMobileWatchlistView] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [assets, setAssets] = useState<Asset[]>(suggestedAssets);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const isCollapsed = mobile ? false : collapsed;

  useEffect(() => {
    let active = true;
    const updateAssets = (pinned: Asset[]) => {
      setAssets(pinned.length ? pinned : suggestedAssets);
    };
    const handlePinnedAssetsChanged = (event: Event) => {
      updateAssets((event as CustomEvent<Asset[]>).detail);
    };
    const refreshFromAlpaca = () => {
      void syncPinnedAssets(true)
        .then(updateAssets)
        .catch((error: unknown) => {
          console.error("Failed to sync sidebar watchlist from Alpaca:", error);
        });
    };

    window.addEventListener(
      PINNED_ASSETS_CHANGED_EVENT,
      handlePinnedAssetsChanged,
    );
    window.addEventListener("focus", refreshFromAlpaca);
    const interval = window.setInterval(refreshFromAlpaca, 60_000);
    void Promise.resolve().then(() => {
      try {
        const pinned = readPinnedAssets();
        if (active) updateAssets(pinned);
      } catch (error) {
        console.error("Failed to load sidebar watchlist:", error);
      }
      if (active) refreshFromAlpaca();
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshFromAlpaca);
      window.removeEventListener(
        PINNED_ASSETS_CHANGED_EVENT,
        handlePinnedAssetsChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (mobile && watchlistRequest > 0) {
      setIsWatchlistOpen(true);
      setIsMobileWatchlistView(true);
    }
  }, [mobile, watchlistRequest]);

  useEffect(() => {
    const openWatchlist = () => {
      if (mobile) {
        setIsMobileWatchlistView(true);
      } else {
        setCollapsed(false);
      }
      setIsWatchlistOpen(true);
    };
    window.addEventListener(OPEN_WATCHLIST_EVENT, openWatchlist);
    return () => window.removeEventListener(OPEN_WATCHLIST_EVENT, openWatchlist);
  }, [mobile]);

  useEffect(() => {
    if (!isWatchlistOpen || !assets.length) return;

    const controller = new AbortController();
    let active = true;
    const loadQuotes = async () => {
      try {
        const { quotes: nextQuotes } = await getMarketQuotes(
          assets.map((asset) => asset.symbol),
          [],
          controller.signal,
        );
        if (active) {
          setQuotes((current) => ({
            ...current,
            ...Object.fromEntries(
              nextQuotes.map((quote) => [quote.symbol, quote]),
            ),
          }));
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        console.error("Failed to load sidebar watchlist quotes:", error);
      }
    };

    void loadQuotes();
    const interval = window.setInterval(() => void loadQuotes(), 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [assets, isWatchlistOpen]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  const navClass = (active: boolean) =>
    [
      `relative flex h-9 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-ui-sm font-normal no-underline transition-colors duration-[120ms] ${
        active && !mobile ? "" : "hover:bg-elevated"
      } hover:text-content ${
        active ? "!text-content" : mobile ? "!text-opposite" : "text-content-secondary"
      }`,
      active &&
        `font-medium hover:!text-content before:absolute before:inset-y-[7px] before:left-0 before:w-0.5 before:rounded-r before:bg-content before:content-[''] ${mobile ? "bg-content/10" : ""}`,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      className={`${mobile
        ? "h-full w-full overflow-hidden"
        : `sticky top-0 z-30 h-screen shrink-0 overflow-visible transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? "w-16" : "w-60"}`
      }`}
    >
      <div className={`flex h-full ${mobile
        ? `w-[200%] transition-[translate] duration-200 ease-in-out motion-reduce:transition-none ${isMobileWatchlistView ? "-translate-x-1/2" : "translate-x-0"}`
        : "w-full"
      }`}>
        <aside className={`flex h-full flex-col bg-base text-content-secondary ${mobile ? "w-1/2 shrink-0" : "w-full border-r border-border"}`}>
            <div className={`flex h-14 shrink-0 items-center px-3 ${
              isCollapsed ? "justify-end" : "justify-between"
            }`}>
              <span
                aria-hidden={isCollapsed}
                className={`papertrade-logo overflow-hidden whitespace-nowrap text-ui-base font-bold transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                  isCollapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"
                }`}
              >
                PaperTrade
              </span>
              {mobile ? (
                <Button
                  type="text"
                  aria-label="Close navigation"
                  icon={<X aria-hidden />}
                  onClick={onNavigate}
                  className="!flex !size-9 !items-center !justify-center !rounded-full !p-0 !text-content-secondary hover:!bg-elevated hover:!text-content"
                />
              ) : (
            <button
              title={collapsed ? "Expand sidebar" : undefined}
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-md text-content-secondary transition-colors duration-120 hover:bg-elevated hover:text-content"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <ChevronLeft
                size={17}
                className={`transition-transform duration-200 ease-in-out motion-reduce:transition-none ${
                  collapsed ? "rotate-180" : ""
                }`}
              />
            </button>
              )}
            </div>

        <nav
          aria-label="Main navigation"
          className="flex min-h-0 flex-1 flex-col p-2"
        >
          <ul className="m-0 flex w-full list-none flex-col gap-0.5 p-0">
            {navigationLinks.map(({ name, href, icon: Icon }) => {
              const isWatchlist = name === "Watchlist";
              const active = isWatchlist ? isWatchlistOpen : isActive(href);
              const content = (
                <>
                  <Icon
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.7}
                    className="shrink-0"
                  />
                  <span
                    className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                      isCollapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100"
                    }`}
                  >
                    {name}
                  </span>
                  {isWatchlist && (
                    <ChevronDown
                      aria-hidden="true"
                      className={`ml-auto shrink-0 transition-[max-width,opacity,transform] duration-200 ease-in-out motion-reduce:transition-none ${
                        isWatchlistOpen ? "rotate-180" : ""
                      } ${
                        isCollapsed
                          ? "max-w-0 overflow-hidden opacity-0"
                          : "max-w-4 opacity-100"
                        }`}
                      size={16}
                      strokeWidth={1.7}
                    />
                  )}
                </>
              );

              return (
                <Fragment key={href}>
                  {name === "Portfolio" && (
                    <li className={`mt-3 flex h-10.5 items-end border-t border-border px-3 pb-2 text-ui-sm font-normal ${mobile ? "text-content-secondary" : "text-content-muted"}`}>
                      <span
                        className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                          isCollapsed ? "max-w-0 opacity-0" : "max-w-20 opacity-100"
                        }`}
                      >
                        Account
                      </span>
                    </li>
                  )}
                  <li>
                    {isWatchlist ? (
                      <button
                        title={isCollapsed ? name : undefined}
                        type="button"
                        aria-expanded={isWatchlistOpen}
                        className={navClass(active)}
                        onClick={() => {
                          if (mobile) {
                            setIsWatchlistOpen(true);
                            setIsMobileWatchlistView(true);
                          } else {
                            setIsWatchlistOpen((value) => !value);
                          }
                        }}
                      >
                        {content}
                      </button>
                    ) : (
                      <Link
                        title={isCollapsed ? name : undefined}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={navClass(active)}
                        onClick={onNavigate}
                      >
                        {content}
                      </Link>
                    )}
                    {isWatchlist && (
                      <ul
                        aria-hidden={!isWatchlistOpen}
                        inert={!isWatchlistOpen || isCollapsed}
                        className={`ml-7.5 flex list-none flex-col gap-px overflow-x-hidden p-0 transition-[max-height,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
                          isWatchlistOpen && !isCollapsed
                            ? "my-1 max-h-56 overflow-y-auto opacity-100"
                            : "my-0 max-h-0 overflow-y-hidden opacity-0"
                        }`}
                        aria-label="Watchlist prices"
                      >
                        {assets.map((asset) => {
                          const quote = quotes[asset.symbol];
                          const positive =
                            typeof quote?.dp === "number" && quote.dp >= 0;
                          const hasChange =
                            typeof quote?.dp === "number" &&
                            Number.isFinite(quote.dp);
                          return (
                            <li key={asset.symbol}>
                              <Link
                                href="/markets"
                                className="grid min-h-7 grid-cols-[minmax(38px,1fr)_auto_auto] items-center gap-2 rounded px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-120 hover:bg-elevated hover:text-content"
                                title={asset.name}
                                onClick={onNavigate}
                              >
                                <span className="truncate text-content">
                                  {asset.symbol.includes(":")
                                    ? asset.symbol.split(":")[1].replace("USDT", "")
                                    : asset.symbol}
                                </span>
                                <span className="tabular-nums">
                                  {formatPrice(quote?.c)}
                                </span>
                                <span
                                  className={`min-w-12 text-right tabular-nums ${!hasChange
                                    ? ""
                                    : positive
                                      ? "text-green-500"
                                      : "text-red-500"
                                    }`}
                                >
                                  {hasChange
                                    ? `${positive ? "+" : ""}${quote.dp!.toFixed(2)}%`
                                    : "—"}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>

        </nav>
        </aside>
        {mobile && (
          <div className="h-full w-1/2 shrink-0">
            <WatchlistPanel
              mobile
              isOpen={isWatchlistOpen}
              onClose={() => {
                setIsMobileWatchlistView(false);
                setIsWatchlistOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {!mobile && (
        <WatchlistPanel
          isOpen={isWatchlistOpen}
          onClose={() => setIsWatchlistOpen(false)}
        />
      )}
    </div>
  );
}
