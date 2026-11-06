export type RangeKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "ALL";
export type Interval = "1day" | "15min";
export type OrderSide = "buy" | "sell";
export type OrderStatus = "filled" | "pending" | "cancelled";

export interface Position { symbol: string; name: string; shares: number; avgCost: number }
export interface WatchItem { symbol: string; name: string }
export interface Order {
  id: string; symbol: string; side: OrderSide; type: "market" | "limit";
  qty: number; price: number; status: OrderStatus; createdAt: string;
}
export interface Account {
  startingBalance: number; cash: number;
  positions: Position[]; orders: Order[]; watchlist: WatchItem[];
}

export interface Quote {
  symbol: string; price: number; change: number; changePct: number;
  high: number; low: number; open: number; prevClose: number; timestamp: number;
}
export interface NewsItem {
  id: number; headline: string; source: string; url: string; image: string; datetime: number;
}
export interface Series { t: string[]; c: number[] }
export interface CurvePoint { t: string; value: number; bench: number }

export interface DashboardResponse {
  quotes: Record<string, Quote>; asOf: number;
}
export interface CandlesResponse { series: Record<string, Series> }