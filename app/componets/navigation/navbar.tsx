"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "antd";
import {
  Bell,
  CircleCheck,
  Info,
  Moon,
  Settings,
  Sun,
  Trash2,
  TriangleAlert,
  UserRound,
  Wallet,
  ArrowDownToLine,
  Menu,
} from "lucide-react";
import {
  getMarketIndexQuote,
  type Quote,
} from "@/lib/client/markets";
import {
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/client/notifications";

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

export default function Navbar({
  onOpenNavigation,
}: {
  onOpenNavigation?: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [indices, setIndices] = useState<IndexData[]>(
    indexList.map(({ key, name }) => ({ key, name, quote: null })),
  );
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const seenFinnhubNotifications = useRef(new Set<string>());
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
    return subscribeToNotifications((notification) => {
      if (notification.type === "finnhub" && notification.symbol) {
        if (seenFinnhubNotifications.current.has(notification.symbol)) return;
        seenFinnhubNotifications.current.add(notification.symbol);
      }
      setNotifications((current) => [notification, ...current].slice(0, 20));
      setUnreadCount((count) => count + 1);
    });
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

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !userMenuRef.current?.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isUserMenuOpen]);

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

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-base px-3 sm:gap-4 sm:px-4">
      <Button
        type="text"
        aria-label="Open navigation"
        icon={<Menu aria-hidden />}
        onClick={onOpenNavigation}
        className="!hidden !size-9 !shrink-0 !items-center !justify-center !p-0 !text-content-secondary max-[760px]:!inline-flex"
      />
      <div className="min-w-0 flex-1" />

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
              className="absolute right-0 top-[calc(100%+10px)] z-50 flex max-h-[min(34rem,calc(100vh-72px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-border bg-surface"
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

        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            className="grid size-[34px] place-items-center rounded-md text-content-secondary transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
            aria-label="Account menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => setIsUserMenuOpen((open) => !open)}
          >
            <span className="grid size-[30px] place-items-center rounded-md border border-border bg-surface text-content-secondary">
              <UserRound size={16} strokeWidth={1.7} aria-hidden="true" />
            </span>
          </button>
          {isUserMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-md border border-border bg-surface p-1">
              <Link
                href="/portfolio"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex h-9 items-center gap-2 rounded px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
              >
                <Wallet size={16} strokeWidth={1.7} />
                My Portfolio
              </Link>
              <Link
                href="/deposit"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex h-9 items-center gap-2 rounded px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
              >
                <ArrowDownToLine size={16} strokeWidth={1.7} />
                Deposit
              </Link>
              <div className="my-1 border-t border-border" />
              <Link
                href="/settings"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex h-9 items-center gap-2 rounded px-2 text-ui-sm text-content-secondary no-underline transition-colors duration-[120ms] hover:bg-elevated hover:text-content"
              >
                <Settings size={16} strokeWidth={1.7} />
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
