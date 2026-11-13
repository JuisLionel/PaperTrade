import { NextResponse } from "next/server";
import {
  AlpacaTradingError,
  getPaperOrders,
  submitPaperOrder,
} from "@/lib/providers/alpaca-trading";
import { rejectNonLocalRequest } from "../local-access";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  try {
    const orders = await getPaperOrders();
    return NextResponse.json(orders, {
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
            : "Could not load Alpaca paper orders.",
      },
      { status },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }

  const { clientOrderId, symbol, side, type, qty, price, crypto } = body;
  if (
    typeof clientOrderId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(clientOrderId) ||
    typeof symbol !== "string" ||
    !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) ||
    (side !== "buy" && side !== "sell") ||
    (type !== "market" && type !== "limit") ||
    typeof qty !== "number" ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    (type === "limit" &&
      (typeof price !== "number" || !Number.isFinite(price) || price <= 0)) ||
    typeof crypto !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Enter a valid Alpaca paper order." },
      { status: 400 },
    );
  }

  try {
    const order = await submitPaperOrder({
      clientOrderId,
      symbol,
      side,
      type,
      qty,
      price: typeof price === "number" ? price : 0,
      crypto,
    });
    return NextResponse.json({ order }, { status: 201 });
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
            : "Could not submit the Alpaca paper order.",
      },
      { status },
    );
  }
}
