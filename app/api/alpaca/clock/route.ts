import { NextResponse } from "next/server";
import {
  AlpacaTradingError,
  getPaperMarketClock,
} from "@/lib/providers/alpaca-trading";
import { rejectNonLocalRequest } from "../local-access";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  try {
    const clock = await getPaperMarketClock();
    return NextResponse.json(clock, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status =
      error instanceof AlpacaTradingError && error.status >= 400 && error.status < 500
        ? error.status
        : error instanceof AlpacaTradingError && error.status === 500
          ? 500
          : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the Alpaca market clock.",
      },
      { status },
    );
  }
}
