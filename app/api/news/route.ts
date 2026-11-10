import { NextResponse } from "next/server";
import { getMarketNews } from "@/lib/providers/finnhub";
import { routeError } from "@/lib/route-error";

export async function GET(request: Request) {
  try {
    const limitParam = new URL(request.url).searchParams.get("limit");
    const requestedLimit = Number(limitParam);
    const limit = limitParam === "all"
      ? null
      : Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(50, Math.floor(requestedLimit))
        : 8;
    return NextResponse.json(await getMarketNews(limit), {
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=240",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
