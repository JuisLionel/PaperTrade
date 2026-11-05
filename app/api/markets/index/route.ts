import { NextResponse } from "next/server";

const SP500_QUOTE_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1m";

type YahooIndexMeta = {
  symbol?: unknown;
  longName?: unknown;
  shortName?: unknown;
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

export async function GET() {
  try {
    const response = await fetch(SP500_QUOTE_URL, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      throw new Error(`S&P 500 data source returned ${response.status}.`);
    }

    const body = (await response.json()) as YahooChartResponse;
    const meta = body.chart?.result?.[0]?.meta;
    if (!meta) {
      throw new Error(
        body.chart?.error?.description ?? "S&P 500 price is unavailable.",
      );
    }

    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new Error("S&P 500 price is unavailable.");
    }

    const previousClose = meta.chartPreviousClose;
    const change =
      typeof previousClose === "number" && Number.isFinite(previousClose)
        ? price - previousClose
        : null;
    const reportedChangePercent = meta.regularMarketChangePercent;
    const changePercent =
      typeof reportedChangePercent === "number" &&
      Number.isFinite(reportedChangePercent)
        ? reportedChangePercent
        : change !== null && typeof previousClose === "number" && previousClose !== 0
          ? (change / previousClose) * 100
          : null;

    return NextResponse.json({
      symbol: typeof meta.symbol === "string" ? meta.symbol : "^GSPC",
      name:
        typeof meta.shortName === "string"
          ? meta.shortName
          : typeof meta.longName === "string"
            ? meta.longName
            : "S&P 500",
      c: price,
      d: change,
      dp: changePercent,
      t:
        typeof meta.regularMarketTime === "number"
          ? meta.regularMarketTime
          : undefined,
    });
  } catch (error) {
    console.error("Failed to load the S&P 500 index quote:", error);
    return NextResponse.json(
      { error: "Could not load the S&P 500 index quote." },
      { status: 502 },
    );
  }
}
