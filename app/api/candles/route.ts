import { NextResponse } from "next/server";
import { routeError } from "@/lib/route-error";
import { parseSymbols } from "@/lib/symbols";
import { getSeries } from "@/lib/providers/twelvedata";
import type { CandlesResponse, Interval } from "@/types/trading";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbols = parseSymbols(params.get("symbols"));
  const interval = params.get("interval") === "15min" ? "15min" : ("1day" as Interval);
  if (!symbols.length) return NextResponse.json({ error: "No symbols given" }, { status: 400 });

  try {
    const body: CandlesResponse = { series: await getSeries(symbols, interval) };
    return NextResponse.json(body);
  } catch (e) {
    return routeError(e);
  }
}