import type { Asset } from "@/lib/client/markets";
import type { Account, MarketClock, Order, Position } from "@/types/trading";

const PAPER_API_BASE = "https://paper-api.alpaca.markets/v2";
const PAPER_WATCHLIST_NAME = "PaperTrade";

export class AlpacaTradingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AlpacaTradingError";
  }
}

interface AlpacaAccountResponse {
  status: string;
  cash: string;
  buying_power: string;
  equity: string;
  last_equity: string;
}

interface AlpacaPositionResponse {
  symbol: string;
  asset_class: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
}

interface AlpacaOrderResponse {
  id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  filled_avg_price: string | null;
  limit_price: string | null;
  side: "buy" | "sell";
  type: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
}

interface AlpacaHistoryResponse {
  equity: Array<number | string | null>;
  base_value: number | string | null;
}

interface AlpacaClockResponse {
  is_open: boolean;
  next_open: string;
  next_close: string;
  timestamp: string;
}

interface AlpacaWatchlistSummary {
  id: string;
  name: string;
}

interface AlpacaWatchlistAssetResponse {
  symbol: string;
  name?: string;
  class?: string;
  asset_class?: string;
}

interface AlpacaWatchlistResponse extends AlpacaWatchlistSummary {
  assets: AlpacaWatchlistAssetResponse[];
}

export interface PaperWatchlistSnapshot {
  exists: boolean;
  assets: Asset[];
}

export interface PaperOrderRequest {
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  price: number;
  crypto: boolean;
}

function requiredNumber(value: string | number | null, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AlpacaTradingError(`Alpaca returned an invalid ${label}.`, 502);
  }
  return parsed;
}

async function alpacaRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const key = process.env.APCA_API_KEY_ID;
  const secret = process.env.APCA_API_SECRET_KEY;
  if (!key || !secret) {
    throw new AlpacaTradingError(
      "Configure APCA_API_KEY_ID and APCA_API_SECRET_KEY with Alpaca paper-account credentials.",
      500,
    );
  }

  const response = await fetch(`${PAPER_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { message?: unknown; error?: unknown };
      if (typeof body.message === "string") detail = body.message;
      else if (typeof body.error === "string") detail = body.error;
    } catch {
      detail = "";
    }
    throw new AlpacaTradingError(
      detail || `Alpaca paper API request failed (${response.status}).`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

function appSymbol(symbol: string, crypto: boolean) {
  return crypto ? symbol.replace("/", "") : symbol;
}

function isCancelable(status: string) {
  return [
    "new",
    "accepted",
    "pending_new",
    "accepted_for_bidding",
    "partially_filled",
    "held",
  ].includes(status);
}

function normalizeOrder(order: AlpacaOrderResponse): Order {
  const crypto = order.asset_class === "crypto";
  const status = order.status.toLowerCase();
  const pending = isCancelable(status) || status === "pending_cancel";
  const appStatus =
    status === "filled"
      ? "filled"
      : status === "canceled" || status === "cancelled" || status === "expired" || status === "rejected"
        ? "cancelled"
        : "pending";
  const orderType = order.type.toLowerCase();

  return {
    id: order.id,
    symbol: appSymbol(order.symbol, crypto),
    side: order.side,
    type: orderType === "limit" ? "limit" : "market",
    brokerType: order.type,
    qty: requiredNumber(order.qty, "order quantity"),
    price: Number(order.filled_avg_price ?? order.limit_price ?? 0),
    status: appStatus,
    brokerStatus: order.status,
    filledQty: requiredNumber(order.filled_qty ?? "0", "filled quantity"),
    filledAveragePrice:
      order.filled_avg_price === null
        ? undefined
        : requiredNumber(order.filled_avg_price, "average fill price"),
    limitPrice:
      order.limit_price === null
        ? undefined
        : requiredNumber(order.limit_price, "limit price"),
    createdAt: order.submitted_at ?? order.created_at,
    cancelable: pending && status !== "pending_cancel",
    crypto,
  };
}

export async function getPaperOrders(): Promise<Order[]> {
  const rawOrders = await alpacaRequest<AlpacaOrderResponse[]>(
    "/orders?status=all&limit=500&direction=desc",
  );
  return rawOrders.map(normalizeOrder);
}

export async function getPaperMarketClock(): Promise<MarketClock> {
  const clock = await alpacaRequest<AlpacaClockResponse>("/clock");
  if (
    typeof clock.is_open !== "boolean" ||
    !Number.isFinite(Date.parse(clock.next_open)) ||
    !Number.isFinite(Date.parse(clock.next_close)) ||
    !Number.isFinite(Date.parse(clock.timestamp))
  ) {
    throw new AlpacaTradingError("Alpaca returned an invalid market clock.", 502);
  }
  return {
    isOpen: clock.is_open,
    nextOpen: clock.next_open,
    nextClose: clock.next_close,
    timestamp: clock.timestamp,
  };
}

function appWatchlistAsset(asset: AlpacaWatchlistAssetResponse): Asset {
  const crypto =
    asset.class === "crypto" ||
    asset.asset_class === "crypto" ||
    asset.symbol.includes("/");
  return {
    symbol: crypto
      ? `BINANCE:${asset.symbol.replace(/\//g, "")}`
      : asset.symbol,
    name: asset.name || asset.symbol,
    kind: crypto ? "Crypto" : "Stock",
  };
}

function alpacaWatchlistSymbol(asset: Asset) {
  const isCrypto =
    asset.kind.toLowerCase().includes("crypto") ||
    asset.symbol.startsWith("BINANCE:");
  if (isCrypto) {
    const match = /^BINANCE:([A-Z0-9]+)USDT$/.exec(asset.symbol);
    if (!match) {
      throw new AlpacaTradingError(
        `Alpaca cannot sync the crypto symbol ${asset.symbol} from this watchlist.`,
        400,
      );
    }
    return `${match[1]}/USDT`;
  }

  const symbol = asset.symbol.toUpperCase();
  if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) {
    throw new AlpacaTradingError(
      `Invalid Alpaca watchlist symbol: ${asset.symbol}.`,
      400,
    );
  }
  return symbol;
}

async function findPaperWatchlist() {
  const watchlists =
    await alpacaRequest<AlpacaWatchlistSummary[]>("/watchlists");
  if (!Array.isArray(watchlists)) {
    throw new AlpacaTradingError(
      "Alpaca returned an invalid watchlist response.",
      502,
    );
  }
  const matches = watchlists.filter(
    (watchlist) =>
      watchlist &&
      typeof watchlist.id === "string" &&
      typeof watchlist.name === "string" &&
      watchlist.name.toLowerCase() === PAPER_WATCHLIST_NAME.toLowerCase(),
  );
  if (matches.length > 1) {
    throw new AlpacaTradingError(
      'Alpaca has multiple watchlists named "PaperTrade". Keep one with that name to avoid editing the wrong list.',
      409,
    );
  }
  return matches[0];
}

export async function getPaperWatchlist(): Promise<PaperWatchlistSnapshot> {
  const summary = await findPaperWatchlist();
  if (!summary) return { exists: false, assets: [] };

  const watchlist = await alpacaRequest<AlpacaWatchlistResponse>(
    `/watchlists/${encodeURIComponent(summary.id)}`,
  );
  if (!Array.isArray(watchlist.assets)) {
    throw new AlpacaTradingError(
      "Alpaca returned an invalid PaperTrade watchlist.",
      502,
    );
  }
  return {
    exists: true,
    assets: watchlist.assets.map(appWatchlistAsset),
  };
}

export async function updatePaperWatchlist(assets: Asset[]) {
  if (assets.length > 1000) {
    throw new AlpacaTradingError(
      "The Alpaca PaperTrade watchlist can contain at most 1,000 items.",
      400,
    );
  }
  const symbols = [...new Set(assets.map(alpacaWatchlistSymbol))];
  if (symbols.length !== assets.length) {
    throw new AlpacaTradingError(
      "The Alpaca PaperTrade watchlist contains duplicate symbols.",
      400,
    );
  }

  const watchlist = await findPaperWatchlist();
  const body = JSON.stringify({ name: PAPER_WATCHLIST_NAME, symbols });
  if (watchlist) {
    await alpacaRequest(`/watchlists/${encodeURIComponent(watchlist.id)}`, {
      method: "PUT",
      body,
    });
  } else {
    await alpacaRequest("/watchlists", { method: "POST", body });
  }
  return getPaperWatchlist();
}

export async function getPaperAccount(): Promise<Account> {
  const [account, rawPositions, orders, history] = await Promise.all([
    alpacaRequest<AlpacaAccountResponse>("/account"),
    alpacaRequest<AlpacaPositionResponse[]>("/positions"),
    getPaperOrders(),
    alpacaRequest<AlpacaHistoryResponse>(
      "/account/portfolio/history?period=all&timeframe=1D",
    ),
  ]);

  const positions: Position[] = rawPositions.map((position) => {
    const crypto = position.asset_class === "crypto";
    return {
      symbol: appSymbol(position.symbol, crypto),
      name: appSymbol(position.symbol, crypto),
      shares: requiredNumber(position.qty, "position quantity"),
      avgCost: requiredNumber(position.avg_entry_price, "average entry price"),
      currentPrice: requiredNumber(position.current_price, "position price"),
      marketValue: requiredNumber(position.market_value, "position market value"),
      unrealizedPnl: requiredNumber(position.unrealized_pl, "unrealized P&L"),
      unrealizedPnlPct:
        requiredNumber(position.unrealized_plpc, "unrealized P&L percentage") *
        100,
      intradayPnl: requiredNumber(
        position.unrealized_intraday_pl,
        "intraday P&L",
      ),
    };
  });
  const equity = requiredNumber(account.equity, "account equity");
  const lastEquity = requiredNumber(account.last_equity, "last account equity");
  const baseValue = Number(history.base_value);
  const historyEquities = history.equity
    .filter((value): value is number | string => value !== null)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const startingBalance =
    Number.isFinite(baseValue) && baseValue > 0
      ? baseValue
      : historyEquities[0] ?? equity;
  const latestHistoryValue = historyEquities.at(-1) ?? equity;
  const totalReturn = latestHistoryValue - startingBalance;

  return {
    startingBalance,
    cash: requiredNumber(account.cash, "account cash"),
    equity,
    lastEquity,
    buyingPower: requiredNumber(account.buying_power, "buying power"),
    dayPnl: equity - lastEquity,
    dayPnlPct: lastEquity ? ((equity - lastEquity) / lastEquity) * 100 : 0,
    totalReturn,
    totalReturnPct: startingBalance
      ? (totalReturn / startingBalance) * 100
      : 0,
    status: account.status,
    positions,
    orders,
    watchlist: [],
  };
}

export async function submitPaperOrder(input: PaperOrderRequest): Promise<Order> {
  const symbol =
    input.crypto && input.symbol.endsWith("USD")
      ? `${input.symbol.slice(0, -3)}/USD`
      : input.symbol;
  const timeInForce = input.crypto ? "gtc" : input.type === "limit" ? "gtc" : "day";
  const body: Record<string, string> = {
    client_order_id: input.clientOrderId,
    symbol,
    qty: String(input.qty),
    side: input.side,
    type: input.type,
    time_in_force: timeInForce,
  };
  if (input.type === "limit") body.limit_price = String(input.price);

  const order = await alpacaRequest<AlpacaOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeOrder(order);
}

export async function cancelPaperOrder(orderId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    throw new AlpacaTradingError("Invalid Alpaca order ID.", 400);
  }
  await alpacaRequest<void>(`/orders/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
  });
}
