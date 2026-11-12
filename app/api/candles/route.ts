import { NextResponse } from "next/server";
import { routeError } from "@/lib/route-error";
import { parseSymbols } from "@/lib/symbols";
import { getSeries } from "@/lib/providers/alpaca";
import type { CandlesResponse, Interval } from "@/types/trading";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbols = parseSymbols(params.get("symbols"));
  const interval = params.get("interval") === "15min" ? "15min" : ("1day" as Interval);
  if (!symbols.length) return NextResponse.json({ error: "No symbols given" }, { status: 400 });

  try {
    const body: CandlesResponse = { series: await getSeries(symbols, interval) };
    const maxAge = interval === "1day" ? 600 : 120;
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      },
    });
  } catch (e) {
    return routeError(e);
  }
}