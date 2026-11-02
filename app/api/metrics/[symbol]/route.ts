import { NextResponse } from "next/server";
import { finnhub } from "../../../../lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  try {
    const data = await finnhub(
      "/stock/metric",
      { symbol: symbol.toUpperCase(), metric: "all" },
      21600
    );
    return NextResponse.json(data.metric ?? {});
  } catch {
    return NextResponse.json({});
  }
}