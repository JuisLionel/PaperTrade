import { NextResponse } from "next/server";
import {
  AlpacaTradingError,
  getPaperAccount,
} from "@/lib/providers/alpaca-trading";
import { rejectNonLocalRequest } from "../local-access";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  try {
    const account = await getPaperAccount();
    return NextResponse.json(account, {
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
            : "Could not load the Alpaca paper account.",
      },
      { status },
    );
  }
}
