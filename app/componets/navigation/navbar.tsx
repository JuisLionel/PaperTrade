"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoMdNotificationsOutline } from "react-icons/io";
import { LuWallet, LuArrowDownToLine, LuSettings, LuUser, LuSun, LuMoon } from "react-icons/lu";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiTrash2 } from "react-icons/fi";
import {
  getSp500IndexQuote,
  type Quote,
} from "@/lib/client/markets";
import {
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/client/notifications";

type Theme = "dark" | "light";
const THEME_STORAGE_KEY = "papertrade-theme";
const accountLinks = [
  { name: "My Wallet", href: "/wallet", icon: LuWallet },
  { name: "Deposit", href: "/deposit", icon: LuArrowDownToLine },
  { name: "Settings", href: "/settings", icon: LuSettings },
];

export default function Navbar() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sp500Quote, setSp500Quote] = useState<Quote | null>(null);
  const [isSp500Loading, setIsSp500Loading] = useState(true);
  const [sp500Error, setSp500Error] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const seenFinnhubNotifications = useRef(new Set<string>());
  const hasManualTheme = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const hasSavedTheme = savedTheme === "light" || savedTheme === "dark";
    hasManualTheme.current = hasSavedTheme;
    const initialTheme: Theme =
      hasSavedTheme
        ? savedTheme
        : mediaQuery.matches
          ? "light"
          : "dark";

    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };

    applyTheme(initialTheme);

    if (hasManualTheme.current) return;

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (!hasManualTheme.current) {
        applyTheme(event.matches ? "light" : "dark");
      }
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

    const loadSp500Quote = async () => {
      try {
        const quote = await getSp500IndexQuote(controller.signal);
        if (
          !quote ||
          typeof quote.c !== "number" ||
          !Number.isFinite(quote.c)
        ) {
          throw new Error(quote?.error ?? "S&P 500 quote is unavailable.");
        }

        if (active) {
          setSp500Quote(quote);
          setSp500Error(null);
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        console.error("Failed to load the S&P 500 index quote:", error);
        setSp500Error(
          error instanceof Error ? error.message : "Quote unavailable",
        );
      } finally {
        if (active) setIsSp500Loading(false);
      }
    };

    void loadSp500Quote();
    const interval = window.setInterval(() => {
      void loadSp500Quote();
    }, 60_000);

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

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    hasManualTheme.current = true;
    setTheme(nextTheme);
  };

  const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur();
  const formatChange = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
      : "—";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-border bg-base/80 px-4 backdrop-blur sm:px-6">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/markets"
          aria-label="View S&P 500 market details"
          title={sp500Error ?? "S&P 500 index"}
          className="flex min-w-0 items-center gap-2 rounded-full bg-elevated px-5 py-2 border-border border transition hover:bg-surface"
        >
          <span className="shrink-0 text-xs font-medium text-base-muted sm:text-sm">
            S&amp;P 500
          </span>
          <span className="hidden text-[10px] text-base-muted sm:inline">
            INDEX
          </span>
          <span
            aria-live="polite"
            className="truncate text-xs font-medium tabular-nums text-content sm:text-sm"
          >
            {sp500Quote && typeof sp500Quote.c === "number"
              ? sp500Quote.c.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
              : isSp500Loading
                ? "Loading"
                : "—"}
          </span>
          {sp500Quote && (
            <span
              className={`hidden shrink-0 text-xs tabular-nums sm:inline ${(sp500Quote.dp ?? 0) >= 0 ? "text-success" : "text-error"
                }`}
            >
              {formatChange(sp500Quote.dp)}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="btn btn-ghost btn-circle size-10 min-h-10 bg-elevated text-content hover:bg-surface"
        >
          {theme === "dark" ? <LuSun className="h-5 w-5" /> : <LuMoon className="h-5 w-5" />}
        </button>

        <div ref={notificationsRef} className="relative grid size-10 shrink-0 place-items-center">
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 z-10 badge badge-secondary h-5 min-h-0 min-w-5 px-1 text-[10px] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const opening = !isNotificationsOpen;
              if (opening) setUnreadCount(0);
              setIsNotificationsOpen(opening);
            }}
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            aria-controls="notifications-panel"
            title="Notifications"
            className="btn btn-ghost btn-circle size-10 min-h-10 bg-elevated text-content hover:bg-surface"
          >
            <IoMdNotificationsOutline className="h-5 w-5" />
          </button>

          {isNotificationsOpen && (
            <section
              id="notifications-panel"
              aria-label="Notifications"
              className="absolute right-0 top-full z-50 mt-3 flex max-h-[min(34rem,calc(100dvh-5rem))] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-base shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-content">
                  Notifications
                </h2>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotifications([]);
                      setUnreadCount(0);
                      seenFinnhubNotifications.current.clear();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-content-secondary transition hover:text-content"
                  >
                    <FiTrash2 aria-hidden="true" />
                    Clear all
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-content-secondary">
                    You&apos;re all caught up.
                  </p>
                ) : (
                  notifications.map((notification) => {
                    const Icon =
                      notification.type === "purchase"
                        ? FiCheckCircle
                        : notification.type === "finnhub"
                          ? FiAlertTriangle
                          : FiInfo;
                    return (
                      <article
                        key={notification.id}
                        className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0"
                      >
                        <Icon
                          aria-hidden="true"
                          className={`mt-0.5 shrink-0 ${notification.type === "finnhub"
                              ? "text-warning"
                              : "text-success"
                            }`}
                          size={18}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-medium text-content">
                              {notification.title}
                            </h3>
                            <time
                              dateTime={new Date(
                                notification.createdAt,
                              ).toISOString()}
                              className="shrink-0 text-[11px] text-content-muted"
                            >
                              {new Date(
                                notification.createdAt,
                              ).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </time>
                          </div>
                          <p className="mt-1 text-sm leading-5 text-content-secondary">
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

        {/* Account */}
        <div className="dropdown dropdown-end">
          <button
            type="button"
            aria-label="Account menu"
            className="btn btn-ghost btn-circle size-10 min-h-10 bg-elevated text-content hover:bg-surface"
          >
            <LuUser size={20} />
          </button>

          <ul
            tabIndex={-1}
            className="dropdown-content menu menu-sm z-30 mt-5 w-56 border border-border rounded-[10px] bg-base p-2 shadow-2xl"
          >
            {accountLinks.map(({ name, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={closeDropdown}
                  className="gap-3 text-content-secondary hover:bg-elevated hover:text-content"
                >
                  <Icon size={16} className="text-content-muted" />
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}