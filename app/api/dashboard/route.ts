import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/providers/finnhub";
import { routeError } from "@/lib/route-error";
import { parseSymbols } from "@/lib/symbols";
import type { DashboardResponse } from "@/types/trading";

export async function GET(req: Request) {
  const symbols = parseSymbols(new URL(req.url).searchParams.get("symbols"));
  let quotes: Awaited<ReturnType<typeof getQuotes>>;
  try {
    quotes = await getQuotes(symbols);
  } catch (error) {
    return routeError(error);
  }

  const body: DashboardResponse = {
    quotes,
    asOf: Date.now(),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
    },
  });
}