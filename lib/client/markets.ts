import { publishFinnhub423Notification } from "./notifications";

export type Asset = { symbol: string; name: string; kind: string };

export type Quote = {
  symbol: string;
  c: number | null;
  d: number | null;
  dp: number | null;
  h: number | null;
  l: number | null;
  o: number | null;
  pc?: number | null;
  t?: number | null;
  logo?: string | null;
  error?: string;
  errorCode?: number;
  rateLimited?: boolean;
};

export class MarketApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(message);
    this.name = "MarketApiError";
  }
}

async function fetchAssets(url: string, operation: string, signal?: AbortSignal) {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new MarketApiError(
      `${operation} (${response.status}).`,
      response.status,
      response.headers.get("Retry-After"),
    );
  }
  return response.json() as Promise<Asset[]>;
}

/** Every US symbol Finnhub has (S&P 500 first). */
export function getMarketSymbols(signal?: AbortSignal) {
  return fetchAssets(
    "/api/markets/symbols?v=2",
    "Could not load symbols",
    signal,
  );
}

export function getSp500Symbols(signal?: AbortSignal) {
  return fetchAssets(
    "/api/markets/symbols?kind=sp500&v=2",
    "Could not load S&P 500 symbols",
    signal,
  );
}

export async function getSp500IndexQuote(signal?: AbortSignal): Promise<Quote> {
  const response = await fetch(
    "/api/markets/index",
    signal ? { signal } : undefined,
  );
  const result = (await response.json()) as {
    symbol?: unknown;
    c?: unknown;
    d?: unknown;
    dp?: unknown;
    t?: unknown;
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : `Could not load the S&P 500 index quote (${response.status}).`,
    );
  }
  if (typeof result.c !== "number" || !Number.isFinite(result.c)) {
    throw new Error("S&P 500 quote response is invalid.");
  }

  return {
    symbol: typeof result.symbol === "string" ? result.symbol : "^GSPC",
    c: result.c,
    d: typeof result.d === "number" ? result.d : null,
    dp: typeof result.dp === "number" ? result.dp : null,
    h: null,
    l: null,
    o: null,
    t: typeof result.t === "number" ? result.t : undefined,
  };
}

export function getCryptoSymbols(signal?: AbortSignal) {
  return fetchAssets(
    "/api/markets/symbols?kind=crypto&v=2",
    "Could not load crypto symbols",
    signal,
  );
}

export function searchMarketSymbols(query: string, signal?: AbortSignal) {
  return fetchAssets(
    `/api/markets/symbols?q=${encodeURIComponent(query)}`,
    "Could not search symbols",
    signal,
  );
}

export async function getMarketQuotes(
  symbols: string[],
  logoSymbols: string[],
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}&logos=${encodeURIComponent(logoSymbols.join(","))}`,
    { signal },
  );
  if (!response.ok && response.status !== 429) {
    throw new Error(`Could not load market quotes (${response.status}).`);
  }

  const quotes = (await response.json()) as Quote[];
  quotes
    .filter((quote) => quote.errorCode === 423)
    .forEach((quote) => publishFinnhub423Notification(quote.symbol));

  return {
    quotes,
    status: response.status,
    retryAfter: response.headers.get("Retry-After"),
  };
}