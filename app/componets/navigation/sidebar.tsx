"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  Clock3,
  LayoutDashboard,
  Newspaper,
  Settings,
  Star,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import {
  getMarketQuotes,
  type Asset,
  type Quote,
} from "@/lib/client/markets";
import {
  PINNED_ASSETS_CHANGED_EVENT,
  readPinnedAssets,
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

export default function Sidebar() {
  const pathname = usePathname();
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [assets, setAssets] = useState<Asset[]>(suggestedAssets);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    let active = true;
    const updateAssets = (pinned: Asset[]) => {
      setAssets(pinned.length ? pinned.slice(0, 5) : suggestedAssets);
    };
    const handlePinnedAssetsChanged = (event: Event) => {
      updateAssets((event as CustomEvent<Asset[]>).detail);
    };

    window.addEventListener(
      PINNED_ASSETS_CHANGED_EVENT,
      handlePinnedAssetsChanged,
    );
    void Promise.resolve().then(() => {
      try {
        const pinned = readPinnedAssets();
        if (active) updateAssets(pinned);
      } catch (error) {
        console.error("Failed to load sidebar watchlist:", error);
      }
    });
    return () => {
      active = false;
      window.removeEventListener(
        PINNED_ASSETS_CHANGED_EVENT,
        handlePinnedAssetsChanged,
      );
    };
  }, []);

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
      "relative flex h-9 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-ui-sm font-normal text-content-secondary no-underline transition-colors duration-[120ms] hover:bg-elevated hover:text-content",
      active &&
        "bg-content/10 font-medium !text-content hover:!text-content before:absolute before:inset-y-[7px] before:left-0 before:w-0.5 before:rounded-r before:bg-content before:content-['']",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      className={`relative sticky top-0 z-30 h-screen shrink-0 transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? "w-16" : "w-60"
        }`}
    >
      <aside className="flex h-full w-full flex-col border-r border-border bg-base text-content-secondary">
        <div
          className={`flex h-14 shrink-0 items-center px-3 ${
            collapsed ? "justify-end" : "justify-between"
          }`}
        >
          <span
            aria-hidden={collapsed}
            className={`papertrade-logo overflow-hidden whitespace-nowrap text-ui-base font-bold transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
              collapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"
            }`}
          >
            PaperTrade
          </span>
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
                      collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100"
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
                        collapsed
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
                    <li className="mt-3 flex h-[42px] items-end border-t border-border px-3 pb-2 text-ui-sm font-normal text-content-muted">
                      <span
                        className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                          collapsed ? "max-w-0 opacity-0" : "max-w-20 opacity-100"
                        }`}
                      >
                        Account
                      </span>
                    </li>
                  )}
                  <li>
                    {isWatchlist ? (
                      <button
                        title={collapsed ? name : undefined}
                        type="button"
                        aria-expanded={isWatchlistOpen}
                        className={navClass(active)}
                        onClick={() => setIsWatchlistOpen((value) => !value)}
                      >
                        {content}
                      </button>
                    ) : (
                      <Link
                        title={collapsed ? name : undefined}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={navClass(active)}
                      >
                        {content}
                      </Link>
                    )}
                    {isWatchlist && (
                      <ul
                        aria-hidden={!isWatchlistOpen}
                        inert={!isWatchlistOpen || collapsed}
                        className={`ml-[30px] flex list-none flex-col gap-px overflow-hidden p-0 transition-[max-height,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
                          isWatchlistOpen && !collapsed
                            ? "my-1 max-h-40 opacity-100"
                            : "my-0 max-h-0 opacity-0"
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
                                className="grid min-h-7 grid-cols-[minmax(38px,1fr)_auto_auto] items-center gap-2 rounded px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
                                title={asset.name}
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

          <div className="mt-auto px-2 pb-3">
            <Link
              title={collapsed ? "Settings" : undefined}
              href="/settings"
              aria-current={isActive("/settings") ? "page" : undefined}
              className={navClass(isActive("/settings"))}
            >
              <Settings
                aria-hidden="true"
                size={18}
                strokeWidth={1.7}
                className="shrink-0"
              />
              <span
                className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                  collapsed ? "max-w-0 opacity-0" : "max-w-24 opacity-100"
                }`}
              >
                Settings
              </span>
            </Link>
          </div>
        </nav>
      </aside>

      <WatchlistPanel
        isOpen={isWatchlistOpen}
      />
    </div>
  );
}
