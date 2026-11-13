import { NextResponse } from "next/server";
import {
  AlpacaTradingError,
  cancelPaperOrder,
} from "@/lib/providers/alpaca-trading";
import { rejectNonLocalRequest } from "../../local-access";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;

  const { orderId } = await context.params;
  try {
    await cancelPaperOrder(orderId);
    return NextResponse.json({ cancelled: true });
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
            : "Could not cancel the Alpaca paper order.",
      },
      { status },
    );
  }
}
