import { NextResponse } from "next/server";
import { finnhub } from "@/lib/providers/finnhub";
import { routeError } from "@/lib/route-error";

const MARKET_INDICES = {
  sp500: { symbol: "^GSPC", name: "S&P 500", provider: "yahoo" },
  btc: { symbol: "BINANCE:BTCUSDT", name: "BTC", provider: "finnhub" },
  dow: { symbol: "^DJI", name: "Dow", provider: "yahoo" },
  nasdaq: { symbol: "^IXIC", name: "Nasdaq", provider: "yahoo" },
  russell: { symbol: "^RUT", name: "Russell 2000", provider: "yahoo" },
} as const;

type MarketIndex = keyof typeof MARKET_INDICES;

type FinnhubQuote = {
  c?: unknown;
  d?: unknown;
  dp?: unknown;
  t?: unknown;
};

type YahooIndexMeta = {
  symbol?: unknown;
  regularMarketPrice?: unknown;
  regularMarketChangePercent?: unknown;
  regularMarketTime?: unknown;
  chartPreviousClose?: unknown;
};

type YahooChartResponse = {
  chart?: {
    result?: { meta?: YahooIndexMeta }[] | null;
    error?: { description?: string } | null;
  };
};

const finiteNumber = (value: unknown) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: Request) {
  const indexKey = new URL(request.url).searchParams.get("index") ?? "sp500";
  if (!Object.hasOwn(MARKET_INDICES, indexKey)) {
    return NextResponse.json({ error: "Unknown market index." }, { status: 400 });
  }
  const index = MARKET_INDICES[indexKey as MarketIndex];

  try {
    let price: number | null;
    let change: number | null;
    let changePercent: number | null;
    let timestamp: number | null;
    let symbol: string = index.symbol;

    if (index.provider === "finnhub") {
      const quote = await finnhub<FinnhubQuote>(
        "/quote",
        { symbol: index.symbol },
        60,
      );
      price = finiteNumber(quote.c);
      change = finiteNumber(quote.d);
      changePercent = finiteNumber(quote.dp);
      timestamp = finiteNumber(quote.t);
    } else {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}?range=1d&interval=1m`,
        { next: { revalidate: 60 } },
      );
      if (!response.ok) {
        throw new Error(`${index.name} data source returned ${response.status}.`);
      }

      const body = (await response.json()) as YahooChartResponse;
      const meta = body.chart?.result?.[0]?.meta;
      if (!meta) {
        throw new Error(
          body.chart?.error?.description ?? `${index.name} price is unavailable.`,
        );
      }

      price = finiteNumber(meta.regularMarketPrice);
      const previousClose = finiteNumber(meta.chartPreviousClose);
      change =
        price !== null && previousClose !== null ? price - previousClose : null;
      changePercent = finiteNumber(meta.regularMarketChangePercent);
      timestamp = finiteNumber(meta.regularMarketTime);
      if (typeof meta.symbol === "string") symbol = meta.symbol;
    }

    if (price === null) throw new Error(`${index.name} price is unavailable.`);

    return NextResponse.json(
      {
        key: indexKey,
        symbol,
        name: index.name,
        c: price,
        d: change,
        dp: changePercent,
        t: timestamp ?? undefined,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error(`Failed to load the ${index.name} index quote:`, error);
    return routeError(error);
  }
}
