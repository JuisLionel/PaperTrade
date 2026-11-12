import type { Interval, Series } from "@/types/trading";
import { UpstreamError } from "@/lib/providers/finnhub";

const BASE = "https://data.alpaca.markets/v2/stocks/bars";
const SIZE: Record<Interval, number> = { "1day": 260, "15min": 27 };

interface AlpacaBar {
  c: number;
  t: string;
}

interface AlpacaBarsResponse {
  bars?: Record<string, AlpacaBar[]>;
  next_page_token?: string | null;
}

export async function getSeries(
  symbols: string[],
  interval: Interval,
): Promise<Record<string, Series>> {
  const key = process.env.APCA_API_KEY_ID;
  const secret = process.env.APCA_API_SECRET_KEY;
  if (!key || !secret) {
    throw new UpstreamError(
      "APCA_API_KEY_ID and APCA_API_SECRET_KEY are required for Alpaca candles",
      500,
    );
  }

  const daily = interval === "1day";
  const now = new Date();
  const bucketMs = 15 * 60 * 1000;
  const end = daily
    ? new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
        ),
      )
    : new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const start = new Date(
    end.getTime() - (daily ? 365 : 7) * 24 * 60 * 60 * 1000,
  );
  const url = new URL(BASE);
  url.search = new URLSearchParams({
    symbols: symbols.join(","),
    timeframe: daily ? "1Day" : "15Min",
    start: daily ? start.toISOString().slice(0, 10) : start.toISOString(),
    end: daily ? end.toISOString().slice(0, 10) : end.toISOString(),
    limit: "10000",
    adjustment: "split",
    feed: "iex",
    sort: "asc",
  }).toString();

  const barsBySymbol: Record<string, AlpacaBar[]> = {};
  const seenPageTokens = new Set<string>();
  let pageToken: string | null = null;
  do {
    if (pageToken) {
      if (seenPageTokens.has(pageToken)) {
        throw new UpstreamError("Alpaca returned a repeated pagination token");
      }
      seenPageTokens.add(pageToken);
      url.searchParams.set("page_token", pageToken);
    }
    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
      },
      next: { revalidate: daily ? 600 : 120 },
    });
    if (response.status === 429) {
      throw new UpstreamError(
        "Alpaca rate limit reached, try again shortly",
        429,
      );
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new UpstreamError(
        `Alpaca request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    const result = (await response.json()) as AlpacaBarsResponse;
    if (!result.bars || typeof result.bars !== "object") {
      throw new UpstreamError("Invalid Alpaca bars response");
    }
    for (const [symbol, bars] of Object.entries(result.bars)) {
      if (!Array.isArray(bars)) {
        throw new UpstreamError(`Invalid Alpaca bars for ${symbol}`);
      }
      barsBySymbol[symbol] ??= [];
      barsBySymbol[symbol].push(...bars);
    }
    pageToken = result.next_page_token ?? null;
  } while (pageToken);

  const series: Record<string, Series> = {};
  for (const [symbol, bars] of Object.entries(barsBySymbol)) {
    const recent = bars.slice(-SIZE[interval]);
    if (!recent.length) continue;
    series[symbol] = {
      t: recent.map((bar) => bar.t),
      c: recent.map((bar) => bar.c),
    };
  }
  if (!Object.keys(series).length) {
    throw new UpstreamError("No price history returned");
  }
  return series;
}
