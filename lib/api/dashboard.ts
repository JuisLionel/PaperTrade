import { getJson } from "@/lib/api/http";
import type { CandlesResponse, DashboardResponse, Interval, NewsItem } from "@/types/trading";

export const fetchDashboard = (symbols: string[], signal?: AbortSignal) =>
  getJson<DashboardResponse>(`/api/dashboard?symbols=${encodeURIComponent(symbols.join(","))}`, signal);

export const fetchMarketNews = (signal?: AbortSignal) =>
  getJson<NewsItem[]>("/api/news", signal);

export const fetchNewsFeed = (signal?: AbortSignal) =>
  getJson<NewsItem[]>("/api/news?limit=all", signal);

export const fetchCandles = (symbols: string[], interval: Interval, signal?: AbortSignal) =>
  getJson<CandlesResponse>(
    `/api/candles?symbols=${encodeURIComponent(symbols.join(","))}&interval=${interval}`,
    signal,
  );