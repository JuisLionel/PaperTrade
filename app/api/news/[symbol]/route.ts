import { NextResponse } from "next/server";
import { finnhub } from "../../../../lib/api";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const news = await finnhub(
      "/company-news",
      { symbol: symbol.toUpperCase(), from: fmt(from), to: fmt(to) },
      900
    );
    return NextResponse.json(Array.isArray(news) ? news.slice(0, 6) : []);
  } catch {
    return NextResponse.json([]);
  }
}