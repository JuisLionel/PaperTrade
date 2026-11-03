export type Asset = { symbol: string; name: string; kind: string };

export type Quote = {
  symbol: string;
  c: number | null;
  d: number | null;
  dp: number | null;
  h: number | null;
  l: number | null;
  o: number | null;
  pc: number | null;
  logo?: string | null;
  error?: string;
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

export function getMarketSymbols() {
  return fetchAssets("/api/markets/symbols", "Could not load symbols");
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

  return {
    quotes: (await response.json()) as Quote[],
    status: response.status,
    retryAfter: response.headers.get("Retry-After"),
  };
}
