import { NextResponse } from "next/server";
import { FinnhubApiError, UpstreamError } from "@/lib/providers/finnhub";

export function routeError(e: unknown) {
  if (e instanceof FinnhubApiError) {
    const status = [403, 429, 500].includes(e.status) ? e.status : 502;
    const message =
      status === 429
        ? "Rate limit hit, try again shortly."
        : status === 403
          ? "Not available on this API plan."
          : e.message;
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: e.retryAfter ? { "Retry-After": e.retryAfter } : undefined,
      },
    );
  }

  const message = e instanceof Error ? e.message : "Unexpected error";
  const status = e instanceof UpstreamError && (e.status === 429 || e.status === 500) ? e.status : 502;
  return NextResponse.json({ error: message }, { status });
}