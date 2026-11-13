"use client";
import { Table, type TableColumnsType } from "antd";
import { dec2, num, signedPct, signedUsd, toneText, usd } from "@/lib/format";
import type { HoldingRow } from "@/lib/portfolio";
import { Card, CardEmpty, CardError, DashboardButton, SkeletonRows } from "./Card";
import { Sparkline } from "./Sparkline";

const columns: TableColumnsType<HoldingRow> = [
  { title: "Symbol", dataIndex: "symbol", sorter: (a, b) => a.symbol.localeCompare(b.symbol),
    render: (v) => <span className="font-semibold text-opposite">{v}</span> },
  { title: "Company", dataIndex: "name", ellipsis: true, render: (v) => <span className="text-content-muted">{v}</span> },
  { title: "Shares", dataIndex: "shares", align: "right", sorter: (a, b) => a.shares - b.shares, render: (v) => num(v) },
  { title: "Avg cost", dataIndex: "avgCost", align: "right", sorter: (a, b) => a.avgCost - b.avgCost,
    render: (v) => <span className="text-content-muted tabular-nums">{dec2(v)}</span> },
  { title: "Last", dataIndex: "last", align: "right", sorter: (a, b) => a.last - b.last, render: (v) => <span className="tabular-nums">{dec2(v)}</span> },
  { title: "Day", dataIndex: "dayPct", align: "right", sorter: (a, b) => a.dayPct - b.dayPct,
    render: (v) => <span className={`tabular-nums ${toneText(v)}`}>{signedPct(v)}</span> },
  { title: "7D", key: "spark", align: "center", render: (_, r) => <Sparkline values={r.spark} up={r.dayPct >= 0 || r.spark.at(-1)! >= r.spark[0]} /> },
  { title: "Value", dataIndex: "marketValue", align: "right", defaultSortOrder: "descend",
    sorter: (a, b) => a.marketValue - b.marketValue, render: (v) => <span className="tabular-nums text-opposite">{dec2(v)}</span> },
  { title: "Unrealized P&L", dataIndex: "unrealizedPnl", align: "right", sorter: (a, b) => a.unrealizedPnl - b.unrealizedPnl,
    render: (_, r) => (
      <div className={`tabular-nums ${toneText(r.unrealizedPnl)}`}>
        <div>{signedUsd(r.unrealizedPnl)}</div>
        <div className="text-[14px] opacity-80">{signedPct(r.unrealizedPnlPct)}</div>
      </div>
    ) },
];

interface Props { rows: HoldingRow[]; loading: boolean; error: string | null; onRetry: () => void; className?: string }

export function HoldingsCard({ rows, loading, error, onRetry, className }: Props) {
  return (
    <Card title="Holdings" className={className}
      action={<span className="text-[17px] text-content-muted">{rows.length} positions</span>}>
      <div className="min-h-0 flex-1 overflow-hidden">
        {error && !rows.length ? (
          <CardError message={error} onRetry={onRetry} />
        ) : loading ? (
          <SkeletonRows rows={7} height="h-9" />
        ) : !rows.length ? (
          <CardEmpty title="No positions yet" text="Your account has $0 invested. Buy your first stock to see it here."
            action={<DashboardButton href="/markets" primary>Place your first order</DashboardButton>} />
        ) : (
          <div className="h-full overflow-hidden px-2 pb-3">
            <Table<HoldingRow> rowKey="symbol" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 760, y: 280 }} size="middle" />
          </div>
        )}
        </div>
    </Card>
  );
}