import { NextResponse } from "next/server";
import { finnhub } from "@/lib/providers/finnhub";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  try {
    const data = await finnhub<{ metric?: Record<string, unknown> }>(
      "/stock/metric",
      { symbol: symbol.toUpperCase(), metric: "all" },
      21600
    );
    return NextResponse.json(data.metric ?? {});
  } catch {
    return NextResponse.json({});
  }
}