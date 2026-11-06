import type { NewsItem, Quote } from "@/types/trading";

const BASE = "https://finnhub.io/api/v1";

export class UpstreamError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export class FinnhubApiError extends UpstreamError {
  constructor(
    message: string,
    status: number,
    public retryAfter: string | null = null,
  ) {
    super(message, status);
    this.name = "FinnhubApiError";
  }
}

export async function finnhub<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate = 15,
): Promise<T> {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new FinnhubApiError("FINNHUB_KEY is missing in .env.local", 500);

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { headers: { "X-Finnhub-Token": key }, next: { revalidate } });
  if (res.status === 429) {
    throw new FinnhubApiError(
      "Finnhub rate limit reached, try again in a minute",
      429,
      res.headers.get("retry-after"),
    );
  }
  if (!res.ok) {
    throw new FinnhubApiError(
      `Finnhub request failed (${res.status})`,
      res.status,
      res.headers.get("retry-after"),
    );
  }
  return res.json() as Promise<T>;
}

interface RawQuote { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number; t: number }

export async function getQuote(symbol: string): Promise<Quote | null> {
  const q = await finnhub<RawQuote>("/quote", { symbol });
  if (!q.c) return null; // Finnhub returns zeros for unknown symbols
  return {
    symbol, price: q.c, change: q.d ?? 0, changePct: q.dp ?? 0,
    high: q.h, low: q.l, open: q.o, prevClose: q.pc, timestamp: q.t,
  };
}

export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  if (!symbols.length) return out;

  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  let firstError: unknown;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value) out[symbols[i]] = r.value;
    } else firstError ??= r.reason;
  });
  if (!Object.keys(out).length && firstError) throw firstError;
  return out;
}

interface RawNews { id: number; headline: string; source: string; url: string; image: string; datetime: number }

export async function getMarketNews(limit = 4): Promise<NewsItem[]> {
  const items = (await finnhub<RawNews[]>("/news", { category: "general" }, 120)).filter(
    (n) => n.headline && n.url,
  );
  const withImage = items.filter((n) => n.image);
  const pool = withImage.length >= limit ? withImage : items;
  return pool.slice(0, limit).map(({ id, headline, source, url, image, datetime }) => ({
    id, headline, source, url, image, datetime,
  }));
}