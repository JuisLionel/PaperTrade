import { NextRequest, NextResponse } from "next/server";
import { FinnhubApiError, finnhub } from "@/lib/providers/finnhub";

const QUOTE_REVALIDATE = 60;
const LOGO_REVALIDATE = 86400;
const MAX_SYMBOLS = 40;

const unavailable = (symbol: string) => ({
  symbol,
  c: null,
  d: null,
  dp: null,
  logo: null,
  error: "Quote unavailable",
});

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);

  const logoSymbols = new Set(
    `${params.get("logos") ?? ""},${params.get("logo") ?? ""}`
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
  );

  const responses = await Promise.all(
    symbols.map(async (symbol) => {
      let quote: Record<string, unknown>;
      try {
        quote = await finnhub("/quote", { symbol }, QUOTE_REVALIDATE);
      } catch (error) {
        if (error instanceof FinnhubApiError && error.status === 429) {
          return {
            result: { symbol, rateLimited: true },
            retryAfter: error.retryAfter,
          };
        }
        if (error instanceof FinnhubApiError && error.status === 423) {
          return {
            result: {
              ...unavailable(symbol),
              error: "Finnhub returned error 423 (Locked).",
              errorCode: 423,
            },
            retryAfter: null,
          };
        }
        console.error(
          `Failed to load ${symbol.includes(":") ? "crypto " : ""}quote for ${symbol}:`,
          error,
        );
        return { result: unavailable(symbol), retryAfter: null };
      }

      let profile: { logo?: string } | null = null;
      if (logoSymbols.has(symbol) && !symbol.includes(":")) {
        try {
          profile = await finnhub<{ logo?: string }>(
            "/stock/profile2",
            { symbol },
            LOGO_REVALIDATE,
          );
        } catch (error) {
          if (error instanceof FinnhubApiError && error.status === 429) {
            return {
              result: { symbol, ...quote, logo: null, rateLimited: true },
              retryAfter: error.retryAfter,
            };
          }
          console.error(`Failed to load company logo for ${symbol}:`, error);
        }
      }

      return {
        result: { symbol, ...quote, logo: profile?.logo ?? null },
        retryAfter: null,
      };
    }),
  );

  const results = responses.map((response) => response.result);
  const retryAfter = responses.find(
    (response) => response.retryAfter,
  )?.retryAfter;
  const rateLimited = results.some(
    (result) => "rateLimited" in result && result.rateLimited === true,
  );
  return NextResponse.json(results, {
    status: rateLimited ? 429 : 200,
    headers: rateLimited
      ? {
          "Cache-Control": "no-store",
          "Retry-After": retryAfter ?? "60",
        }
      : {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        },
  });
}