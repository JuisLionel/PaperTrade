import { getJson } from "@/lib/api/http";
import type { Asset } from "@/lib/client/markets";
import type { Account, MarketClock, Order } from "@/types/trading";

export interface AlpacaWatchlistSnapshot {
  exists: boolean;
  assets: Asset[];
}

export interface AlpacaOrderInput {
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  price: number;
  crypto: boolean;
}

export const fetchAlpacaAccount = (signal?: AbortSignal) =>
  getJson<Account>("/api/alpaca/account", signal);

export const fetchAlpacaOrders = (signal?: AbortSignal) =>
  getJson<Order[]>("/api/alpaca/orders", signal);

export const fetchAlpacaMarketClock = (signal?: AbortSignal) =>
  getJson<MarketClock>("/api/alpaca/clock", signal);

export const fetchAlpacaWatchlist = (signal?: AbortSignal) =>
  getJson<AlpacaWatchlistSnapshot>("/api/alpaca/watchlist", signal);

export async function updateAlpacaWatchlist(
  assets: Asset[],
): Promise<AlpacaWatchlistSnapshot> {
  const response = await fetch("/api/alpaca/watchlist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets }),
  });
  const result = (await response.json()) as
    | AlpacaWatchlistSnapshot
    | { error?: string };
  if (!response.ok) {
    throw new Error(
      "error" in result && typeof result.error === "string"
        ? result.error
        : `Watchlist request failed (${response.status}).`,
    );
  }
  if (!("assets" in result) || !Array.isArray(result.assets)) {
    throw new Error("Alpaca returned no watchlist details.");
  }
  return result;
}

export async function submitAlpacaOrder(input: AlpacaOrderInput): Promise<Order> {
  const response = await fetch("/api/alpaca/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as { order?: Order; error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? `Order request failed (${response.status}).`);
  }
  if (!result.order) throw new Error("Alpaca returned no order details.");
  return result.order;
}

export async function cancelAlpacaOrder(orderId: string): Promise<void> {
  const response = await fetch(
    `/api/alpaca/orders/${encodeURIComponent(orderId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    let message = `Cancel request failed (${response.status}).`;
    try {
      const result = (await response.json()) as { error?: unknown };
      if (typeof result.error === "string") message = result.error;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new Error(message);
  }
}
