import { NextResponse } from "next/server";
import type { Asset } from "@/lib/client/markets";
import {
  AlpacaTradingError,
  getPaperWatchlist,
  updatePaperWatchlist,
} from "@/lib/providers/alpaca-trading";
import { rejectNonLocalRequest } from "../local-access";

function errorResponse(error: unknown, fallback: string) {
  const status =
    error instanceof AlpacaTradingError &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : error instanceof AlpacaTradingError && error.status === 500
        ? 500
        : 502;
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallback,
    },
    { status },
  );
}

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  try {
    return NextResponse.json(await getPaperWatchlist(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "Could not load the Alpaca watchlist.");
  }
}

export async function PUT(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid watchlist request." }, { status: 400 });
  }

  const assets = (body as { assets?: unknown } | null)?.assets;
  if (
    !Array.isArray(assets) ||
    !assets.every(
      (asset): asset is Asset =>
        typeof asset === "object" &&
        asset !== null &&
        "symbol" in asset &&
        typeof asset.symbol === "string" &&
        "name" in asset &&
        typeof asset.name === "string" &&
        "kind" in asset &&
        typeof asset.kind === "string",
    )
  ) {
    return NextResponse.json(
      { error: "Watchlist assets must include a symbol, name, and kind." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await updatePaperWatchlist(assets), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "Could not update the Alpaca watchlist.");
  }
}
