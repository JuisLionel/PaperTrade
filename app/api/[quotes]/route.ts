import { NextRequest, NextResponse } from "next/server";
import { finnhub } from "../../../lib/api";

const QUOTE_REVALIDATE = 60; 
const LOGO_REVALIDATE = 86400;
const MAX_SYMBOLS = 40;

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

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [quote, profile] = await Promise.all([
          finnhub("/quote", { symbol }, QUOTE_REVALIDATE),
          logoSymbols.has(symbol) && !symbol.includes(":")
            ? finnhub<{ logo?: string }>("/stock/profile2", { symbol }, LOGO_REVALIDATE).catch(
                (error: unknown) => {
                  console.error(`Failed to load company logo for ${symbol}:`, error);
                  return null;
                },
              )
            : Promise.resolve(null),
        ]);
        return { symbol, ...quote, logo: profile?.logo ?? null };
      } catch (error) {
        console.error(`Failed to load quote for ${symbol}:`, error);
        return { symbol, c: 0, d: 0, dp: 0, logo: null, error: "Quote unavailable" };
      }
    }),
  );

  return NextResponse.json(results);
}