import { NextRequest, NextResponse } from "next/server";

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.origin === "https://mobiduka.vercel.app" || url.hostname.endsWith(".app.github.dev");
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = isAllowedOrigin(origin);
  const headers = new Headers();

  if (allowed && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Token");
    headers.set("Access-Control-Max-Age", "86400");
  }

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers });
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
