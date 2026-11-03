import { NextResponse } from "next/server";

const TWELVEDATA_KEY = process.env.TWELVEDATA_KEY!;

export class TwelveDataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TwelveDataApiError";
  }
}

export async function twelveData<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate = 3600, // seconds to cache
): Promise<T> {
  const qs = new URLSearchParams({ ...params, apikey: TWELVEDATA_KEY });
  const res = await fetch(`https://api.twelvedata.com${path}?${qs}`, {
    next: { revalidate },
  });
  const body = await res.json();

  // Twelve Data can return HTTP 200 with { status: "error", code, message }
  if (!res.ok || body?.status === "error") {
    throw new TwelveDataApiError(
      body?.message ?? `Twelve Data error ${res.status}`,
      body?.code ?? res.status,
    );
  }
  return body as T;
}

export type HistoryPoint = { t: number; price: number };

export async function getDailyHistory(
  symbol: string,
  days: number,
): Promise<HistoryPoint[]> {
  const d = await twelveData<{ values?: { datetime: string; close: string }[] }>(
    "/time_series",
    { symbol, interval: "1day", outputsize: String(days) },
  );

  if (!d.values?.length) {
    throw new TwelveDataApiError("No candle data", 404);
  }

  // Twelve Data returns newest first, so reverse for the chart
  return d.values
    .map((v) => ({ t: new Date(v.datetime).getTime(), price: parseFloat(v.close) }))
    .reverse();
}

export const isValidSymbol = (s: string) => /^[A-Z0-9.\-:]{1,15}$/.test(s);

const FINNHUB_KEY = process.env.FINNHUB_KEY!;

export class FinnhubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(message);
    this.name = "FinnhubApiError";
  }
}

export async function finnhub<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate = 10 // seconds to cache
): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: FINNHUB_KEY });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${qs}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    throw new FinnhubApiError(
      `Finnhub error ${res.status}`,
      res.status,
      res.headers.get("retry-after"),
    );
  }
  return res.json();
}

export function apiError(e: unknown) {
  if (e instanceof FinnhubApiError || e instanceof TwelveDataApiError) {
    const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
    const message =
      status === 429
        ? "Rate limit hit, try again shortly."
        : status === 403
          ? "Not available on this API plan."
          : e.message;
    const retryAfter = e instanceof FinnhubApiError ? e.retryAfter : null;

    return NextResponse.json(
      { error: message },
      {
        status,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
      }
    );
  }
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
