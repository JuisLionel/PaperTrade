import { NextResponse } from "next/server";

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLocalHostHeader(value: string) {
  try {
    return isLoopback(new URL(`http://${value}`).hostname);
  } catch {
    return false;
  }
}

export function rejectNonLocalRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (
    !isLoopback(requestUrl.hostname) ||
    (forwardedHost && !isLocalHostHeader(forwardedHost))
  ) {
    return NextResponse.json(
      { error: "Alpaca trading is enabled only for local use." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!isLoopback(new URL(origin).hostname)) {
        return NextResponse.json(
          { error: "Cross-origin Alpaca requests are not allowed." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  }

  return null;
}
