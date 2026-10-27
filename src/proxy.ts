import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/checkout/:path*"],
};
