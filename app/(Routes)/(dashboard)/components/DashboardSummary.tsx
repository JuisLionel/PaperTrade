"use client";

import { signedPct, signedUsd, toneText, usd } from "@/lib/format";
import type { Summary } from "@/lib/portfolio";

function SummaryCard({
  label,
  value,
  detail,
  subdetail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  subdetail?: string;
  tone?: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-elevated bg-surface p-3 sm:p-4">
      <p className="truncate text-xs text-content-muted sm:text-sm">{label}</p>
      <p className="mt-2 truncate font-display text-xl font-semibold tabular-nums text-opposite sm:text-2xl">
        {value}
      </p>
      <p className={`mt-2 truncate text-xs tabular-nums ${tone ?? "text-content-muted"}`}>
        {detail}
      </p>
      {subdetail && (
        <p className="truncate text-[11px] tabular-nums text-content-muted">
          {subdetail}
        </p>
      )}
    </article>
  );
}

export function DashboardSummary({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <section
        aria-label="Account summary"
        className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
        aria-busy="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-elevated bg-surface sm:h-28"
          />
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Account summary"
      className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
    >
      <SummaryCard
        label="Total balance"
        value={usd(summary.totalValue)}
        detail={`${usd(summary.cash)} available cash`}
      />
      <SummaryCard
        label="Buying power"
        value={usd(summary.buyingPower)}
        detail="Available to invest"
      />
      <SummaryCard
        label="Today’s P&L"
        value={signedUsd(summary.dayPnl)}
        detail={`${signedPct(summary.dayPct)} today`}
        subdetail="Includes today’s trades"
        tone={toneText(summary.dayPnl)}
      />
      <SummaryCard
        label="Total return"
        value={signedUsd(summary.totalReturn)}
        detail={`${signedPct(summary.totalReturnPct)} since start`}
        subdetail={`${signedUsd(summary.realizedPnl)} realized · ${signedUsd(summary.unrealizedPnl)} open`}
        tone={toneText(summary.totalReturn)}
      />
    </section>
  );
}
