"use client";

import { useState } from "react";
import Link from "next/link";
import { dec2, signedPct, toneText } from "@/lib/format";
import type { HoldingRow } from "@/lib/portfolio";
import type { Order } from "@/types/trading";

type ActivityTab = "Holdings" | "Orders";

export function DashboardActivity({
  rows,
  orders,
  cash,
}: {
  rows: HoldingRow[];
  orders: Order[];
  cash: number;
}) {
  const [tab, setTab] = useState<ActivityTab>("Holdings");
  const recentOrders = [...orders]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);

  return (
    <section className="min-h-[255px] px-5 pb-5 pt-4 min-[900px]:px-6">
      <div className="flex items-center gap-5 border-b border-elevated">
        {(["Holdings", "Orders"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-0.5 pb-2 text-[14px] ${
              tab === value
                ? "border-content font-semibold text-opposite"
                : "border-transparent text-content-muted hover:text-opposite"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "Holdings" ? (
        rows.length ? (
          <div className="overflow-x-auto">
            <table className="mt-1 w-full min-w-[510px] text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="py-2 font-normal">Symbol</th>
                  <th className="py-2 text-right font-normal">Shares</th>
                  <th className="py-2 text-right font-normal">Avg cost</th>
                  <th className="py-2 text-right font-normal">Last</th>
                  <th className="py-2 text-right font-normal">Today</th>
                  <th className="py-2 text-right font-normal">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elevated/70">
                {rows.slice(0, 6).map((row) => (
                  <tr key={row.symbol} className="text-content-secondary">
                    <td className="py-2.5 font-medium text-opposite">
                      {row.symbol}
                      <span className="ml-2 font-normal text-content-muted">
                        {row.name}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.shares}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {dec2(row.avgCost)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {dec2(row.last)}
                    </td>
                    <td className={`py-2.5 text-right tabular-nums ${toneText(row.dayPct)}`}>
                      {signedPct(row.dayPct)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-opposite">
                      {dec2(row.marketValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 6 && (
              <Link
                href="/portfolio"
                className="mt-3 inline-block text-[13px] text-content hover:underline"
              >
                View all {rows.length} holdings →
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-3 flex min-h-[76px] items-center justify-between gap-4 rounded-md px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-opposite">
                You have dont have any holdings yet
              </p>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-content-muted">
                Pick a stock from the movers list and buy your first share. Your
                equity curve starts after your first fill.
              </p>
            </div>
            <Link
              href="/markets"
              className="shrink-0 text-[13px] font-semibold text-content hover:underline"
            >
              Browse markets →
            </Link>
          </div>
        )
      ) : recentOrders.length ? (
        <div className="divide-y divide-elevated/70">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-nowrap items-center justify-between gap-3 whitespace-nowrap py-3 text-[14px]"
            >
              <span className="font-medium capitalize text-opposite">
                {order.side} {order.symbol}
              </span>
              <span className="text-content-muted">
                {order.qty} × {dec2(order.price)}
              </span>
              <span className="capitalize text-content-secondary">
                {order.status}
              </span>
            </div>
          ))}
          <Link
            href="/orders"
            className="mt-3 inline-block text-[13px] text-content hover:underline"
          >
            View all orders →
          </Link>
        </div>
      ) : (
        <div className="mt-3 rounded-md px-4 py-5">
          <p className="text-[14px] font-medium text-opposite">No orders yet</p>
          <p className="mt-1 text-[13px] text-content-muted">
            Orders you place will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
