import type { Interval, Series } from "@/types/trading";
import { UpstreamError } from "@/lib/providers/finnhub";

const SIZE: Record<Interval, number> = { "1day": 260, "15min": 27 }; // ~1 year / 1 session

interface RawSeries {
  status?: string;
  values?: { datetime: string; close: string }[];
}

export async function getSeries(symbols: string[], interval: Interval) {
  const key = process.env.TWELVEDATA_KEY;
  if (!key) throw new UpstreamError("TWELVEDATA_KEY is missing in .env.local", 500);

  const url = new URL("https://api.twelvedata.com/time_series");
  url.search = new URLSearchParams({
    symbol: symbols.join(","), interval, outputsize: String(SIZE[interval]), order: "asc", apikey: key,
  }).toString();

  const res = await fetch(url, { next: { revalidate: interval === "1day" ? 600 : 120 } });
  const json = await res.json();
  if (json.status === "error") {
    const limited = json.code === 429;
    throw new UpstreamError(
      limited ? "Twelve Data rate limit reached, try again in a minute" : json.message ?? "Twelve Data request failed",
      limited ? 429 : 502,
    );
  }

  // one symbol returns a flat object, several return { SYMBOL: {...} }
  const entries: Record<string, RawSeries> = symbols.length === 1 ? { [symbols[0]]: json } : json;
  const out: Record<string, Series> = {};
  for (const [symbol, s] of Object.entries(entries)) {
    if (s.status !== "ok" || !s.values?.length) continue;
    out[symbol] = { t: s.values.map((v) => v.datetime), c: s.values.map((v) => Number(v.close)) };
  }
  if (!Object.keys(out).length) throw new UpstreamError("No price history returned");
  return out;
}