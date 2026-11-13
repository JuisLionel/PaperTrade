"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "antd";
import {
  Bell,
  CircleCheck,
  Info,
  Moon,
  Sun,
  Trash2,
  TriangleAlert,
  UserRound,
  Menu,
} from "lucide-react";
import {
  getMarketIndexQuote,
  type Quote,
} from "@/lib/client/markets";
import {
  fetchAlpacaMarketClock,
  fetchAlpacaOrders,
} from "@/lib/api/alpaca";
import {
  observeAlpacaOrders,
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/client/notifications";
import type { MarketClock } from "@/types/trading";

type Theme = "dark" | "light";
type IndexKey = "sp500" | "btc" | "dow";
type IndexData = { key: IndexKey; name: string; quote: Quote | null };

const THEME_STORAGE_KEY = "papertrade-theme";
const indexList: { key: IndexKey; name: string }[] = [
  { key: "sp500", name: "S&P 500" },
  { key: "btc", name: "BTC" },
  { key: "dow", name: "Dow" },
];
const formatChange = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
    : "—";

const formatMarketTime = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "an unknown time";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
};

export default function Navbar({
  onOpenNavigation,
}: {
  onOpenNavigation?: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<AppNotification | null>(null);
  const [marketClock, setMarketClock] = useState<MarketClock | null>(null);
  const [marketClockLoading, setMarketClockLoading] = useState(true);
  const [marketClockError, setMarketClockError] = useState<string | null>(null);
  const [indices, setIndices] = useState<IndexData[]>(
    indexList.map(({ key, name }) => ({ key, name, quote: null })),
  );
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationToastTimer = useRef<number | null>(null);
  const seenFinnhubNotifications = useRef(new Set<string>());
  const lastOrderMonitorError = useRef<string | null>(null);
  const hasManualTheme = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const hasSavedTheme = savedTheme === "light" || savedTheme === "dark";
    hasManualTheme.current = hasSavedTheme;
    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };

    applyTheme(
      hasSavedTheme ? savedTheme : mediaQuery.matches ? "light" : "dark",
    );
    if (hasManualTheme.current) return;

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (!hasManualTheme.current) applyTheme(event.matches ? "light" : "dark");
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notification) => {
      if (notification.type === "finnhub" && notification.symbol) {
        if (seenFinnhubNotifications.current.has(notification.symbol)) return;
        seenFinnhubNotifications.current.add(notification.symbol);
      }
      setNotifications((current) => [notification, ...current].slice(0, 20));
      setUnreadCount((count) => count + 1);
      if (notification.type === "purchase") {
        setLatestNotification(notification);
        if (notificationToastTimer.current !== null) {
          window.clearTimeout(notificationToastTimer.current);
        }
        notificationToastTimer.current = window.setTimeout(
          () => setLatestNotification(null),
          6_000,
        );
      }
    });
    return () => {
      unsubscribe();
      if (notificationToastTimer.current !== null) {
        window.clearTimeout(notificationToastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadIndices = async () => {
      const results = await Promise.all(
        indexList.map(async ({ key, name }) => {
          try {
            return {
              key,
              name,
              quote: await getMarketIndexQuote(key, controller.signal),
            };
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error(`Failed to load ${name} index quote:`, error);
            }
            return { key, name, quote: null };
          }
        }),
      );
      if (active) {
        setIndices(results);
        setIndicesError(
          results.some((result) => result.quote === null)
            ? "Some market index quotes are unavailable."
            : null,
        );
        setIndicesLoading(false);
      }
    };

    void loadIndices();
    const interval = window.setInterval(() => void loadIndices(), 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;

    const loadMarketClock = async () => {
      request?.abort();
      const currentRequest = new AbortController();
      request = currentRequest;
      try {
        const clock = await fetchAlpacaMarketClock(currentRequest.signal);
        if (!active) return;
        setMarketClock(clock);
        setMarketClockError(null);
      } catch (error) {
        if (!active || currentRequest.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Could not load US market hours.";
        console.error("Failed to load US market hours:", error);
        setMarketClock(null);
        setMarketClockError(message);
      } finally {
        if (active && !currentRequest.signal.aborted) {
          setMarketClockLoading(false);
        }
      }
    };

    void loadMarketClock();
    const interval = window.setInterval(() => void loadMarketClock(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      request?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;

    const checkOrderUpdates = async () => {
      request?.abort();
      const currentRequest = new AbortController();
      request = currentRequest;
      try {
        const orders = await fetchAlpacaOrders(currentRequest.signal);
        if (!active || currentRequest.signal.aborted) return;
        observeAlpacaOrders(orders);
        lastOrderMonitorError.current = null;
      } catch (error) {
        if (!active || currentRequest.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Could not check Alpaca order status.";
        if (lastOrderMonitorError.current !== message) {
          console.error("Failed to check Alpaca order status:", error);
          lastOrderMonitorError.current = message;
        }
      }
    };

    void checkOrderUpdates();
    const interval = window.setInterval(
      () => void checkOrderUpdates(),
      30_000,
    );
    return () => {
      active = false;
      window.clearInterval(interval);
      request?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !notificationsRef.current?.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isNotificationsOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    hasManualTheme.current = true;
    setTheme(nextTheme);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    seenFinnhubNotifications.current.clear();
  };

  const notificationIcon = (notification: AppNotification) => {
    if (notification.type === "purchase") return CircleCheck;
    if (notification.type === "finnhub") return TriangleAlert;
    return Info;
  };
  const marketStatusLabel = marketClock
    ? marketClock.isOpen
      ? "Market open"
      : "Market closed"
    : marketClockLoading
      ? "Checking market"
      : "Market status unavailable";
  const marketStatusTitle = marketClock
    ? `Market ${marketClock.isOpen ? "open" : "closed"}. ${marketClock.isOpen ? "Closes" : "Opens"
    } at ${formatMarketTime(
      marketClock.isOpen ? marketClock.nextClose : marketClock.nextOpen,
    )}.`
    : marketClockError ?? "Checking official market hours.";
  const marketStatusTone = marketClock
    ? marketClock.isOpen
      ? "border-success/30 bg-success/10 text-success"
      : "border-border bg-surface text-content-secondary"
    : marketClockError
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-border bg-surface text-content-muted";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-base px-3 sm:gap-4 sm:px-4">
      <Button
        type="text"
        aria-label="Open navigation"
        icon={<Menu aria-hidden />}
        onClick={onOpenNavigation}
        className="!hidden !size-9 !shrink-0 !items-center !justify-center !p-0 !text-content-secondary max-[760px]:!inline-flex"
      />
      <div className="min-w-0 flex-1" >
        <div
          role="status"
          aria-label={marketStatusLabel}
          title={marketStatusTitle}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-ui-sm sm:gap-2 sm:px-2.5 ${marketStatusTone}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${marketClock
                ? marketClock.isOpen
                  ? "bg-success"
                  : "bg-content-muted"
                : marketClockError
                  ? "bg-danger"
                  : "bg-content-muted"
              }`}
          />
          <span className="hidden whitespace-nowrap sm:inline">
            {marketStatusLabel}
          </span>
          <span className="whitespace-nowrap sm:hidden">
            {marketClock
              ? marketClock.isOpen
                ? "Open"
                : "Closed"
              : marketClockError
                ? "Unavailable"
                : "…"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {indices.map(({ key, name, quote }, index) => {
          const change = quote?.dp;
          const positive = typeof change === "number" && change >= 0;
          const price =
            typeof quote?.c === "number"
              ? quote.c.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
              : indicesLoading
                ? "Loading"
                : "—";
          return (
            <Link
              key={key}
              href="/markets"
              aria-label={`View ${name} market details`}
              title={indicesError ?? `${name} index`}
              className={`${index > 0 ? "hidden xl:inline-flex" : "inline-flex"
                } h-8 min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-[120ms] hover:border-content-muted hover:bg-elevated sm:gap-2 sm:px-2.5`}
            >
              <span className="hidden whitespace-nowrap text-content-muted sm:inline">
                {name}
              </span>
              <span className="whitespace-nowrap tabular-nums">{price}</span>
              <span
                className={`whitespace-nowrap tabular-nums ${typeof change !== "number"
                  ? "text-content-muted"
                  : positive
                    ? "text-green-500"
                    : "text-red-500"
                  }`}
              >
                {formatChange(change)}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          type="button"
          className="grid size-8 place-items-center rounded-md text-content-secondary transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun size={18} strokeWidth={1.7} />
          ) : (
            <Moon size={18} strokeWidth={1.7} />
          )}
        </button>

        <div ref={notificationsRef} className="relative">
          <button
            title="Notifications"
            type="button"
            className="relative grid size-8 place-items-center rounded-md text-content-secondary transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
            onClick={() => {
              const opening = !isNotificationsOpen;
              if (opening) setUnreadCount(0);
              setIsNotificationsOpen(opening);
            }}
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            aria-controls="notifications-panel"
          >
            <Bell size={18} strokeWidth={1.7} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-content" />
            )}
          </button>

          {isNotificationsOpen && (
            <section
              id="notifications-panel"
              aria-label="Notifications"
              className="absolute right-0 top-[calc(100%+10px)] z-50 flex max-h-[min(34rem,calc(100vh-72px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-xl"
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3.5">
                <h2 className="text-ui-sm font-medium text-content-secondary">
                  Notifications
                </h2>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="inline-flex items-center gap-1.5 text-ui-sm text-content-muted transition-colors duration-[120ms] hover:text-content"
                  >
                    <Trash2 size={14} />
                    Clear all
                  </button>
                )}
              </div>
              <div className="min-h-0 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="m-0 px-4 py-7 text-center text-ui-sm text-content-muted">
                    You&apos;re all caught up.
                  </p>
                ) : (
                  notifications.map((notification) => {
                    const Icon = notificationIcon(notification);
                    return (
                      <article
                        key={notification.id}
                        className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 border-b border-border px-3.5 py-3"
                      >
                        <Icon
                          aria-hidden="true"
                          className={`mt-0.5 ${notification.type === "purchase"
                            ? "text-green-500"
                            : notification.type === "finnhub"
                              ? "text-red-500"
                              : "text-content-muted"
                            }`}
                          size={17}
                        />
                        <div>
                          <div className="flex items-start justify-between gap-2.5">
                            <h3 className="m-0 text-ui-sm font-medium text-content-secondary">
                              {notification.title}
                            </h3>
                            <time
                              className="text-ui-sm text-content-muted"
                              dateTime={new Date(
                                notification.createdAt,
                              ).toISOString()}
                            >
                              {new Date(notification.createdAt).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </time>
                          </div>
                          <p className="mt-1 text-ui-sm leading-5 text-content-muted">
                            {notification.message}
                          </p>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>

        <Link
          href="/portfolio"
          className="grid size-[34px] place-items-center rounded-md text-content-secondary transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
          aria-label="My Portfolio"
          title="My Portfolio"
        >
          <span className="grid size-[30px] place-items-center rounded-md border border-border bg-surface text-content-secondary">
            <UserRound size={16} strokeWidth={1.7} aria-hidden="true" />
          </span>
        </Link>
      </div>

      {latestNotification?.type === "purchase" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] flex max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-success/30 bg-surface px-4 py-3 text-content shadow-xl"
        >
          <CircleCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-success"
            size={18}
          />
          <div>
            <p className="m-0 text-sm font-medium text-opposite">
              {latestNotification.title}
            </p>
            <p className="mb-0 mt-1 text-sm text-content-muted">
              {latestNotification.message}
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
