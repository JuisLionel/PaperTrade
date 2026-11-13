import type { Account, CurvePoint, Position, Quote, RangeKey, Series } from "@/types/trading";

export interface HoldingRow extends Position {
  last: number; prevClose: number; dayChange: number; dayPct: number;
  marketValue: number; unrealizedPnl: number; unrealizedPnlPct: number; spark: number[];
}
export interface Summary {
  totalValue: number; cash: number; buyingPower: number;
  dayPnl: number; dayPct: number; totalReturn: number; totalReturnPct: number;
  realizedPnl: number; unrealizedPnl: number;
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
    const last = p.currentPrice ?? q?.price ?? closes[closes.length - 1] ?? p.avgCost;
    const dayChange = q?.change ?? 0;
    const prevClose =
      q?.prevClose && q.prevClose > 0 ? q.prevClose : last - dayChange;
    const marketValue = p.marketValue ?? p.shares * last;
    const cost = p.shares * p.avgCost;
    const unrealizedPnl = p.unrealizedPnl ?? marketValue - cost;
    return {
      ...p, last, prevClose, dayChange,
      dayPct: q?.changePct ?? 0, marketValue,
      unrealizedPnl,
      unrealizedPnlPct:
        p.unrealizedPnlPct ?? (cost ? (unrealizedPnl / cost) * 100 : 0),
      spark: closes.slice(-7),
    };
  });
}

export function getTodayTradeSymbols(account: Account): string[] {
  const today = new Date().toDateString();
  return [
    ...new Set(
      account.orders
        .filter(
          (order) =>
            order.status === "filled" &&
            Number.isFinite(Date.parse(order.createdAt)) &&
            new Date(order.createdAt).toDateString() === today,
        )
        .map((order) => order.symbol),
    ),
  ];
}

function calculateDayPnl(
  account: Account,
  rows: HoldingRow[],
  quotes: Record<string, Quote>,
): number {
  const today = new Date().toDateString();
  const todayOrders = account.orders
    .map((order, index) => ({ order, index, timestamp: Date.parse(order.createdAt) }))
    .filter(
      ({ order, timestamp }) =>
        order.status === "filled" &&
        Number.isFinite(timestamp) &&
        new Date(timestamp).toDateString() === today,
    )
    .sort((a, b) => a.timestamp - b.timestamp || b.index - a.index)
    .map(({ order }) => order);
  const rowsBySymbol = new Map(rows.map((row) => [row.symbol, row]));
  const ordersBySymbol = new Map<string, typeof todayOrders>();
  for (const order of todayOrders) {
    const symbolOrders = ordersBySymbol.get(order.symbol) ?? [];
    symbolOrders.push(order);
    ordersBySymbol.set(order.symbol, symbolOrders);
  }

  const symbols = new Set([
    ...account.positions.map((position) => position.symbol),
    ...ordersBySymbol.keys(),
  ]);
  let dayPnl = 0;

  for (const symbol of symbols) {
    const position = account.positions.find((item) => item.symbol === symbol);
    const symbolOrders = ordersBySymbol.get(symbol) ?? [];
    let shares = position?.shares ?? 0;
    for (let index = symbolOrders.length - 1; index >= 0; index -= 1) {
      shares += symbolOrders[index].side === "buy"
        ? -symbolOrders[index].qty
        : symbolOrders[index].qty;
    }

    const row = rowsBySymbol.get(symbol);
    const quote = quotes[symbol];
    const currentPrice = quote?.price ?? row?.last;
    const previousClose =
      quote?.prevClose && quote.prevClose > 0
        ? quote.prevClose
        : row?.prevClose;
    if (
      currentPrice === undefined ||
      previousClose === undefined ||
      !Number.isFinite(currentPrice) ||
      !Number.isFinite(previousClose) ||
      previousClose <= 0
    ) {
      if (row && symbolOrders.length === 0) {
        dayPnl += row.shares * row.dayChange;
      }
      continue;
    }

    let basis = previousClose;
    let realizedToday = 0;
    for (const order of symbolOrders) {
      if (order.side === "buy") {
        basis = (shares * basis + order.qty * order.price) / (shares + order.qty);
        shares += order.qty;
      } else {
        realizedToday += order.qty * (order.price - basis);
        shares -= order.qty;
        if (shares <= 1e-8) {
          shares = 0;
          basis = 0;
        }
      }
    }
    dayPnl += realizedToday + shares * (currentPrice - basis);
  }

  return dayPnl;
}

export function buildSummary(
  account: Account,
  rows: HoldingRow[],
  quotes: Record<string, Quote>,
): Summary {
  const totalValue =
    account.equity ?? account.cash + sum(rows.map((r) => r.marketValue));
  const dayPnl = account.dayPnl ?? calculateDayPnl(account, rows, quotes);
  const prevTotal = account.lastEquity ?? totalValue - dayPnl;
  const reserved = sum(
    account.orders.filter((o) => o.status === "pending" && o.side === "buy").map((o) => o.qty * o.price),
  );
  const totalReturn = account.totalReturn ?? totalValue - account.startingBalance;
  const unrealizedPnl = sum(rows.map((row) => row.unrealizedPnl));
  return {
    totalValue,
    cash: account.cash,
    buyingPower:
      account.buyingPower ?? Math.max(0, account.cash - reserved),
    dayPnl,
    dayPct:
      account.dayPnlPct ?? (prevTotal ? (dayPnl / prevTotal) * 100 : 0),
    totalReturn,
    totalReturnPct:
      account.totalReturnPct ??
      (account.startingBalance ? (totalReturn / account.startingBalance) * 100 : 0),
    realizedPnl: totalReturn - unrealizedPnl, unrealizedPnl,
  };
}

const BARS = { "1W": 5, "1M": 22, "3M": 66 } as const;

function localTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

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
  const firstTrade = account.orders
    .filter((order) => order.status === "filled")
    .map((order) => Date.parse(order.createdAt))
    .filter(Number.isFinite)
    .reduce<number | null>(
      (earliest, timestamp) =>
        earliest === null || timestamp < earliest ? timestamp : earliest,
      null,
    );
  if (firstTrade === null) return [];

  const src = range === "1D" ? intraday : daily;
  const bench = src["SPY"];
  const held = account.positions.filter((p) => src[p.symbol]);
  if (!bench || held.length !== account.positions.length) return [];

  const L = Math.min(bench.c.length, ...held.map((p) => src[p.symbol].c.length));
  const times = bench.t.slice(-L);
  if (L < 2) return [];

  const firstTradeDate = new Date(firstTrade).toISOString().slice(0, 10);
  const firstTradeBar = times.findIndex((time) =>
    range === "1D"
      ? Date.parse(time) >= firstTrade
      : time.slice(0, 10) >= firstTradeDate,
  );
  if (firstTradeBar < 0 && firstTradeDate > times[L - 1].slice(0, 10)) {
    return [];
  }
  const tradeStart = firstTradeBar < 0 ? 0 : firstTradeBar;

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
  start = Math.max(start, tradeStart);

  const now = new Date();
  const nowTimestamp = localTimestamp(now);
  const today = nowTimestamp.slice(0, 10);
  const currentTotal =
    liveTotal !== undefined && Number.isFinite(liveTotal) ? liveTotal : undefined;
  const latestIsToday = times[L - 1].slice(0, 10) === today;
  const appendLivePoint =
    currentTotal !== undefined &&
    range !== "1D" &&
    !latestIsToday;

  if (appendLivePoint && range !== "YTD" && range !== "ALL") {
    start = Math.max(start, L - BARS[range] + 1);
  }
  if (L - start < 2) return [];

  const at = (s: Series, i: number) => s.c[s.c.length - L + i];
  const valueAt = (i: number) => account.cash + sum(held.map((p) => p.shares * at(src[p.symbol], i)));
  const first = valueAt(start);
  const base = at(bench, start);
  const pts: CurvePoint[] = [];
  for (let i = start; i < L; i++) pts.push({ t: times[i], value: valueAt(i), bench: first * (at(bench, i) / base) });
  if (currentTotal !== undefined && (range !== "1D" || latestIsToday)) {
    if (appendLivePoint) {
      pts.push({ t: today, value: currentTotal, bench: pts[pts.length - 1].bench });
    } else {
      pts[pts.length - 1].value = currentTotal;
      if (latestIsToday) pts[pts.length - 1].t = nowTimestamp;
    }
  }
  return pts;
}