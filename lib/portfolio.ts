import type { Account, CurvePoint, Position, Quote, RangeKey, Series } from "@/types/trading";

export interface HoldingRow extends Position {
  last: number; dayChange: number; dayPct: number;
  marketValue: number; pnl: number; pnlPct: number; spark: number[];
}
export interface Summary {
  totalValue: number; cash: number; buyingPower: number;
  dayPnl: number; dayPct: number; totalReturn: number; totalReturnPct: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function buildHoldingRows(
  positions: Position[],
  quotes: Record<string, Quote>,
  daily: Record<string, Series>,
): HoldingRow[] {
  return positions.map((p) => {
    const q = quotes[p.symbol];
    const closes = daily[p.symbol]?.c ?? [];
    const last = q?.price ?? closes[closes.length - 1] ?? p.avgCost;
    const marketValue = p.shares * last;
    const cost = p.shares * p.avgCost;
    return {
      ...p, last, dayChange: q?.change ?? 0, dayPct: q?.changePct ?? 0, marketValue,
      pnl: marketValue - cost, pnlPct: cost ? ((marketValue - cost) / cost) * 100 : 0,
      spark: closes.slice(-7),
    };
  });
}

export function buildSummary(account: Account, rows: HoldingRow[]): Summary {
  const totalValue = account.cash + sum(rows.map((r) => r.marketValue));
  const dayPnl = sum(rows.map((r) => r.shares * r.dayChange));
  const prevTotal = totalValue - dayPnl;
  const reserved = sum(
    account.orders.filter((o) => o.status === "pending" && o.side === "buy").map((o) => o.qty * o.price),
  );
  const totalReturn = totalValue - account.startingBalance;
  return {
    totalValue, cash: account.cash, buyingPower: Math.max(0, account.cash - reserved),
    dayPnl, dayPct: prevTotal ? (dayPnl / prevTotal) * 100 : 0,
    totalReturn, totalReturnPct: account.startingBalance ? (totalReturn / account.startingBalance) * 100 : 0,
  };
}

const BARS = { "1W": 5, "1M": 22, "3M": 66 } as const;

/**
 * Equity curve = cash + today's shares × historical closes (what the current portfolio
 * would have been worth). SPY is rescaled to the same starting value for comparison.
 */
export function buildEquityCurve(args: {
  range: RangeKey;
  account: Account;
  daily: Record<string, Series>;
  intraday: Record<string, Series>;
  liveTotal?: number;
}): CurvePoint[] {
  const { range, account, daily, intraday, liveTotal } = args;
  const src = range === "1D" ? intraday : daily;
  const bench = src["SPY"];
  const held = account.positions.filter((p) => src[p.symbol]);
  if (!bench || !account.positions.length || held.length !== account.positions.length) return [];

  const L = Math.min(bench.c.length, ...held.map((p) => src[p.symbol].c.length));
  const times = bench.t.slice(-L);

  let start = 0;
  if (range === "1D") {
    const day = times[L - 1].slice(0, 10);
    start = Math.max(0, times.findIndex((t) => t.startsWith(day)));
  } else if (range === "YTD") {
    const jan = `${times[L - 1].slice(0, 4)}-01-01`;
    start = Math.max(0, times.findIndex((t) => t >= jan));
  } else if (range !== "ALL") {
    start = Math.max(0, L - BARS[range]);
  }
  if (L - start < 2) return [];

  const at = (s: Series, i: number) => s.c[s.c.length - L + i];
  const valueAt = (i: number) => account.cash + sum(held.map((p) => p.shares * at(src[p.symbol], i)));
  const first = valueAt(start);
  const base = at(bench, start);

  const pts: CurvePoint[] = [];
  for (let i = start; i < L; i++) pts.push({ t: times[i], value: valueAt(i), bench: first * (at(bench, i) / base) });
  if (liveTotal) pts[pts.length - 1].value = liveTotal;
  return pts;
}