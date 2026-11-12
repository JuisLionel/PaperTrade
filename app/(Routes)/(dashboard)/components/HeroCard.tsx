"use client";
import { Segmented } from "antd";
import type { CurvePoint, RangeKey } from "@/types/trading";
import { CardError } from "./Card";
import { EquityChart } from "./EquityChart";

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "YTD", "ALL"];

interface Props {
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  points: CurvePoint[];
  hasTrades: boolean;
  curve: { loading: boolean; error: string | null; onRetry: () => void };
}

export function HeroCard({ range, onRange, points, hasTrades, curve }: Props) {
  return (
    <section className="min-w-0 rounded-xl border border-elevated bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-opposite sm:text-xl">
            Portfolio performance
          </h2>
          <p className="mt-1 text-xs text-content-muted sm:text-sm">
            Track your account over time
          </p>
        </div>
        <Segmented
          block
          className="w-full bg-elevated! text-ui-sm sm:w-auto [&_.ant-segmented-item-label]:flex! [&_.ant-segmented-item-label]:h-8! [&_.ant-segmented-item-label]:items-center! [&_.ant-segmented-item-label]:justify-center! [&_.ant-segmented-item-label]:px-1.5! sm:[&_.ant-segmented-item-label]:px-2! [&_.ant-segmented-item-label]:leading-none! [&_.ant-segmented-item-selected]:bg-content! [&_.ant-segmented-item-selected]:text-base! [&_.ant-segmented-item:hover]:text-opposite!"
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
        <div className="h-44 animate-pulse rounded-xl bg-elevated sm:h-52" aria-busy="true" />
      ) : points.length < 2 ? (
        <div className="flex h-44 items-center justify-center rounded-lg px-4 text-center text-ui-base text-content-muted sm:h-52">
          {hasTrades
            ? "Portfolio history is not available for this range."
            : "It seems that you haven't made any trades yet. let's start by placing your first order to see your portfolio performance here."}
        </div>
      ) : (
        <EquityChart points={points} range={range} />
      )}
    </section>
  );
}