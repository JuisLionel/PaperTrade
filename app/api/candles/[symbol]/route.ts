import { NextResponse } from "next/server";
import { getDailyHistory, isValidSymbol, apiError } from "@/lib/api";

// Approximate trading days per range
const RANGES: Record<string, number> = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252 };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const range = new URL(req.url).searchParams.get("range") ?? "3M";

  if (!isValidSymbol(symbol) || !(range in RANGES)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const points = await getDailyHistory(symbol, RANGES[range]);
    return NextResponse.json({ points });
  } catch (e) {
    return apiError(e);
  }
}