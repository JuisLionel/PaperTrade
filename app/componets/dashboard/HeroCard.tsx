"use client";
import Link from "next/link";
import { Segmented } from "antd";
import { LuArrowDownRight, LuArrowUpRight, LuEllipsis } from "react-icons/lu";
import type { Summary } from "@/lib/portfolio";
import { signedPct, signedUsd, toneText, usd } from "@/lib/format";
import type { CurvePoint, RangeKey } from "@/types/trading";
import { CardError, IconButton } from "./Card";
import { EquityChart } from "./EquityChart";

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "YTD", "ALL"];

interface Props {
  summary: Summary | null;
  stale: boolean;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  points: CurvePoint[];
  curve: { loading: boolean; error: string | null; empty: boolean; onRetry: () => void };
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-36 flex-1 px-6 py-4 min-[761px]:min-w-44 min-[761px]:px-7 min-[761px]:py-5 lg:border-l lg:border-elevated lg:first:border-l-0 lg:first:pl-0">
      <p className="text-ui-sm text-content-muted">{label}</p>
      <p className={`font-display text-[20px] tabular-nums min-[761px]:text-[24px] ${tone ?? "text-opposite"}`}>
        {value} {sub && <span className="text-ui-sm">{sub}</span>}
      </p>
    </div>
  );
}

export function HeroCard({ summary, stale, range, onRange, points, curve }: Props) {
  const [whole, cents] = summary ? usd(summary.totalValue).split(".") : ["", ""];
  const up = (summary?.dayPnl ?? 0) >= 0;
  const Arrow = up ? LuArrowUpRight : LuArrowDownRight;

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="grid gap-4 p-5 pb-0 min-[760px]:grid-cols-[230px_minmax(0,1fr)] min-[850px]:grid-cols-[372px_minmax(0,1fr)] sm:p-6 sm:pb-0 min-[761px]:gap-5 min-[761px]:p-7 min-[761px]:pb-0">
        <div>
          <p className="text-ui-base text-content-secondary">Total portfolio value</p>
          {summary ? (
            <>
              <p className="font-display my-3 text-[42px] font-light leading-none tracking-[-0.03em] text-opposite tabular-nums min-[761px]:text-[50px] min-[850px]:text-[67px]">
                {whole}<span className="text-content-muted">.{cents}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className={`font-semibold tabular-nums ${toneText(summary.dayPnl)}`}>{signedUsd(summary.dayPnl)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-ui-sm font-semibold tabular-nums ${up ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                  <Arrow aria-hidden /> {signedPct(summary.dayPct)}
                </span>
              </div>
              <p className="mt-1.5 text-ui-sm text-content-muted">
                {stale ? "Live prices unavailable, showing cost basis" : "Today"}
              </p>
            </>
          ) : (
            <div className="my-3 space-y-3" aria-busy="true">
              <div className="h-14 w-64 animate-pulse rounded-lg bg-elevated" />
              <div className="h-5 w-40 animate-pulse rounded-lg bg-elevated" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="flex gap-4 text-ui-sm text-content-muted">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-success" />Portfolio</span>
            </span>
            <Segmented
              className="min-[761px]:[&_.ant-segmented-item-label]:text-[15px]! [&_.ant-segmented-item:hover]:!text-content [&_.ant-segmented-item:hover]:outline [&_.ant-segmented-item:hover]:outline-1 [&_.ant-segmented-item:hover]:outline-content"
              shape="round"
              size="small"
              options={RANGES}
              value={range}
              onChange={(v) => onRange(v as RangeKey)}
            />
          </div>
          {curve.error ? (
            <CardError message={curve.error} onRetry={curve.onRetry} />
          ) : curve.loading ? (
            <div className="h-[190px] animate-pulse rounded-xl bg-elevated" aria-busy="true" />
          ) : curve.empty || points.length < 2 ? (
            <div className="flex h-[190px] items-center justify-center text-center text-ui-sm text-content-muted">
              Place your first order to start your equity curve.
            </div>
          ) : (
            <EquityChart points={points} range={range} />
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap border-t border-elevated px-6 min-[761px]:mt-6">
        {summary ? (
          <>
            <Stat label="Buying power" value={usd(summary.buyingPower)} />
            <Stat label="Cash" value={usd(summary.cash)} />
            <Stat label="Day P&L" value={signedUsd(summary.dayPnl)} tone={toneText(summary.dayPnl)} />
            <Stat label="Total return" value={signedUsd(summary.totalReturn)} sub={signedPct(summary.totalReturnPct)} tone={toneText(summary.totalReturn)} />
          </>
        ) : (
          <div className="my-4 h-12 w-full animate-pulse rounded-lg bg-elevated" aria-busy="true" />
        )}
      </div>
    </section>
  );
}