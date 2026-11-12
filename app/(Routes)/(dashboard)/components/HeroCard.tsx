"use client";
import { Segmented } from "antd";
import type { Summary } from "@/lib/portfolio";
import { signedPct, signedUsd, toneText, usd } from "@/lib/format";
import type { CurvePoint, RangeKey } from "@/types/trading";
import { CardError } from "./Card";
import { EquityChart } from "./EquityChart";

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "YTD", "ALL"];

interface Props {
  summary: Summary | null;
  stale: boolean;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  points: CurvePoint[];
  curve: { loading: boolean; error: string | null; onRetry: () => void };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-ui-sm text-content-muted">{label}</p>
      <p className={`mt-1 text-ui-lg font-medium tabular-nums ${tone ?? "text-opposite"}`}>
        {value}
      </p>
    </div>
  );
}

export function HeroCard({ summary, stale, range, onRange, points, curve }: Props) {
  const [whole, cents] = summary ? usd(summary.totalValue).split(".") : ["", ""];
  const returnUp = (summary?.totalReturn ?? 0) >= 0;

  return (
    <section className="overflow-hidden border-b border-elevated bg-surface">
      <div className="grid gap-5 p-4 min-[760px]:grid-cols-[210px_minmax(0,1fr)] min-[1050px]:grid-cols-[230px_minmax(0,1fr)] min-[761px]:gap-6 min-[900px]:p-6">
        <div className="min-w-0">
          <p className="text-ui-base text-content-muted">Portfolio value</p>
          {summary ? (
            <>
              <p className="font-display my-2 whitespace-nowrap text-[42px] font-medium leading-none tracking-[-0.04em] text-opposite tabular-nums sm:text-[52px] min-[900px]:text-[62px]">
                {whole}.<span className="text-opposite">{cents}</span>
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-elevated px-2.5 py-1 text-ui-sm">
                <i className={`size-1.5 rounded-full ${returnUp ? "bg-success" : "bg-danger"}`} />
                <span className="text-opposite">{signedUsd(summary.totalReturn)}</span>
                <span className="text-content-muted">profit</span>
                <span className={toneText(summary.totalReturn)}>{signedPct(summary.totalReturnPct)}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat
                  label="Today"
                  value={signedUsd(summary.dayPnl)}
                  tone={toneText(summary.dayPnl)}
                />
                <Stat
                  label="All time"
                  value={signedPct(summary.totalReturnPct)}
                  tone={toneText(summary.totalReturn)}
                />
              </div>
              {stale && (
                <p className="mt-3 text-ui-sm text-content-muted">
                  Live prices unavailable
                </p>
              )}
            </>
          ) : (
            <div className="my-3 space-y-3" aria-busy="true">
              <div className="h-12 w-40 animate-pulse rounded-lg bg-elevated" />
              <div className="h-5 w-32 animate-pulse rounded-lg bg-elevated" />
            </div>
          )}
        </div>

        <div className="w-full min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ui-sm text-content-muted">
              <i className="size-1.5 rounded-full bg-content" />
              Portfolio
            </span>
            <Segmented
              block
              className="w-full bg-elevated! text-ui-sm sm:w-auto [&_.ant-segmented-item-label]:!flex [&_.ant-segmented-item-label]:!h-8 [&_.ant-segmented-item-label]:!items-center [&_.ant-segmented-item-label]:!justify-center [&_.ant-segmented-item-label]:!px-1.5 sm:[&_.ant-segmented-item-label]:!px-2 [&_.ant-segmented-item-label]:!leading-none [&_.ant-segmented-item-selected]:bg-content! [&_.ant-segmented-item-selected]:text-base! [&_.ant-segmented-item:hover]:text-opposite!"
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
            <div className="h-35 animate-pulse rounded-xl bg-elevated min-[761px]:h-40" aria-busy="true" />
          ) : points.length < 2 ? (
            <div className="flex h-35 items-center justify-center text-center text-ui-base text-content-muted min-[761px]:h-40">
              Portfolio history is not available for this range.
            </div>
          ) : (
            <EquityChart points={points} range={range} />
          )}
        </div>
      </div>
    </section>
  );
}