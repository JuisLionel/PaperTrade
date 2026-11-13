"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiInbox,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { useAccount } from "@/app/Hooks/useAccount";
import { getMarketQuotes } from "@/lib/client/markets";
import { cancelAlpacaOrder } from "@/lib/api/alpaca";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

type Tone = "success" | "warning" | "danger" | "neutral";
type Filter = "all" | "open" | "filled" | "closed";

const TONE_STYLES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-border/50 text-content-muted",
};

const DOT_STYLES: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-content-muted",
};

const OPEN_STATUSES = [
  "new",
  "accepted",
  "pending_new",
  "partially_filled",
  "pending_cancel",
  "pending_replace",
  "held",
];

function getStatus(status: string) {
  const key = status.toLowerCase();
  const label = key.replace(/_/g, " ");
  let tone: Tone = "neutral";
  let group: Exclude<Filter, "all"> = "closed";

  if (key === "filled") {
    tone = "success";
    group = "filled";
  } else if (OPEN_STATUSES.includes(key)) {
    tone = "warning";
    group = "open";
  } else if (key === "rejected") {
    tone = "danger";
  }

  return { label, tone, group };
}

function formatDate(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = getStatus(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${TONE_STYLES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[tone]}`} />
      {label}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  const isBuy = side === "buy";
  const Icon = isBuy ? FiArrowUpRight : FiArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${isBuy ? TONE_STYLES.success : TONE_STYLES.danger
        }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {side}
    </span>
  );
}

function SymbolAvatar({ symbol, logo }: { symbol: string; logo?: string }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const showLogo = Boolean(logo && logo !== failedLogo);

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-base text-[11px] font-bold text-opposite">
      {showLogo ? (
        <img
          src={logo}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedLogo(logo ?? null)}
        />
      ) : (
        symbol.slice(0, 4)
      )}
    </span>
  );
}

function CancelButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FiX className="h-3.5 w-3.5" />
      {busy ? "Cancelling…" : "Cancel"}
    </button>
  );
}

export default function OrdersClient() {
  const { account, loading, error: accountError, refresh } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const orders = useMemo(
    () =>
      [...(account?.orders ?? [])].sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
    [account?.orders],
  );

  const counts = useMemo(() => {
    const result = { all: orders.length, open: 0, filled: 0, closed: 0 };
    for (const order of orders) {
      result[getStatus(order.brokerStatus ?? order.status).group] += 1;
    }
    return result;
  }, [orders]);

  const visible = orders.filter(
    (order) =>
      filter === "all" ||
      getStatus(order.brokerStatus ?? order.status).group === filter,
  );
  const logoSymbols = useMemo(
    () =>
      [
        ...new Set(
          visible
            .filter((order) => !order.crypto && !order.symbol.includes(":"))
            .map((order) => order.symbol),
        ),
      ].join(","),
    [visible],
  );

  useEffect(() => {
    const symbols = logoSymbols.split(",").filter(Boolean);
    if (!symbols.length) return;

    const controller = new AbortController();
    const loadLogos = async () => {
      const nextLogos: Record<string, string> = {};
      try {
        for (let start = 0; start < symbols.length; start += 5) {
          if (start > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 300));
          }
          const batch = symbols.slice(start, start + 5);
          const result = await getMarketQuotes(
            batch,
            batch,
            controller.signal,
          );
          result.quotes.forEach((quote) => {
            if (quote.logo) nextLogos[quote.symbol] = quote.logo;
          });
          if (result.status === 429) {
            throw new Error(
              `Company logos are rate limited. Try again in ${result.retryAfter ?? "60"} seconds.`,
            );
          }
        }
        if (!controller.signal.aborted) {
          setLogos((current) => ({ ...current, ...nextLogos }));
          setLogoError(null);
        }
      } catch (logoLoadError) {
        if (!controller.signal.aborted) {
          setLogoError(
            logoLoadError instanceof Error
              ? logoLoadError.message
              : "Could not load company logos.",
          );
        }
      }
    };

    void loadLogos();
    return () => controller.abort();
  }, [logoSymbols]);

  async function cancelOrder(orderId: string) {
    if (!account) return;
    try {
      setCancellingId(orderId);
      await cancelAlpacaOrder(orderId);
      setError(null);
      await refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Could not cancel this Alpaca paper order.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (loading && !account) {
    return (
      <div className="mt-5 space-y-3" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (accountError && !account) {
    return (
      <div
        className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
        role="alert"
      >
        <p>{accountError}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-2 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-border/50 text-content-muted">
          <FiInbox className="h-6 w-6" />
        </span>
        <p className="font-medium text-opposite">No Alpaca paper orders yet</p>
        <p className="mt-1 text-sm text-content-muted">
          Place a Buy or Sell from the Markets page.
        </p>
        <Link
          href="/markets"
          className="btn btn-sm mt-4 border-0 bg-content text-base no-underline"
        >
          Browse markets
        </Link>
      </div>
    );
  }

  const stats = [
    { label: "Total orders", value: counts.all, tone: "text-opposite" },
    { label: "Open", value: counts.open, tone: "text-warning" },
    { label: "Filled", value: counts.filled, tone: "text-success" },
    { label: "Canceled / closed", value: counts.closed, tone: "text-content-muted" },
  ];

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "filled", label: "Filled" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div className="mt-5 space-y-4">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          className="inline-flex rounded-lg border border-border bg-surface p-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${filter === tab.key
                  ? "bg-content font-medium text-base"
                  : "text-content-muted hover:text-opposite"
                }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content-secondary transition hover:text-opposite disabled:opacity-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-wide text-content-muted">
              {stat.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.tone}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {accountError && (
        <p
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
        >
          Could not refresh the account: {accountError}
        </p>
      )}
      {logoError && logoSymbols && (
        <p role="status" className="text-sm text-content-muted">
          Company logos are unavailable; ticker symbols are shown instead. {logoError}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-content-muted">
          No orders in this view.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Placed</th>
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((order) => {
                  const date = formatDate(order.createdAt);
                  return (
                    <tr
                      key={order.id}
                      className="text-content-secondary transition hover:bg-border/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SymbolAvatar
                            symbol={order.symbol}
                            logo={logos[order.symbol]}
                          />
                          <span className="font-semibold text-opposite">
                            {order.symbol}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SideBadge side={order.side} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {order.qty}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {order.price > 0 ? (
                          <>
                            <p className="text-opposite">{money(order.price)}</p>
                            <p className="text-xs text-content-muted">
                              Total {money(order.price * Number(order.qty))}
                            </p>
                          </>
                        ) : (
                          <span className="text-content-muted">At market</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {order.brokerType ?? order.type}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.brokerStatus ?? order.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p>{date.day}</p>
                        <p className="text-xs text-content-muted">{date.time}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {order.cancelable && (
                          <CancelButton
                            busy={cancellingId === order.id}
                            onClick={() => cancelOrder(order.id)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((order) => {
              const date = formatDate(order.createdAt);
              return (
                <li
                  key={order.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <SymbolAvatar
                        symbol={order.symbol}
                        logo={logos[order.symbol]}
                      />
                      <div>
                        <p className="font-semibold text-opposite">
                          {order.symbol}
                        </p>
                        <p className="text-xs text-content-muted">
                          {date.day} · {date.time}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.brokerStatus ?? order.status} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-content-muted">Side</dt>
                      <dd className="mt-1">
                        <SideBadge side={order.side} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-content-muted">Qty</dt>
                      <dd className="mt-1 tabular-nums text-opposite">
                        {order.qty}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-content-muted">
                        <span className="capitalize">
                          {order.brokerType ?? order.type}
                        </span>
                      </dt>
                      <dd className="mt-1 tabular-nums text-opposite">
                        {order.price > 0 ? money(order.price) : "At market"}
                      </dd>
                    </div>
                  </dl>

                  {order.cancelable && (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <CancelButton
                        busy={cancellingId === order.id}
                        onClick={() => cancelOrder(order.id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}