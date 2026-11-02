import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const normalizedPath = pathname.toLowerCase();

  if (pathname !== normalizedPath) {
    const url = request.nextUrl.clone();
    url.pathname = normalizedPath;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}