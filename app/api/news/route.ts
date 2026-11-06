import { NextResponse } from "next/server";
import { getMarketNews } from "@/lib/providers/finnhub";
import { routeError } from "@/lib/route-error";

export async function GET() {
  try {
    return NextResponse.json(await getMarketNews());
  } catch (error) {
    return routeError(error);
  }
}
