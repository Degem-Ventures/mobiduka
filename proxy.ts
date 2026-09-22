import { NextRequest, NextResponse } from "next/server.js";

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.origin === "https://mobiduka.vercel.app" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".app.github.dev");
  } catch {
    return false;
  }
}

type EdgeTokenClaims = {
  businessId?: unknown;
  subscriptionStatus?: unknown;
  subscriptionExpiresAt?: unknown;
};

function decodeTokenClaims(token: string): EdgeTokenClaims | null {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return null;

  const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as EdgeTokenClaims;
}

function subscriptionIsExpired(claims: EdgeTokenClaims) {
  const status = typeof claims.subscriptionStatus === "string"
    ? claims.subscriptionStatus.toUpperCase()
    : "";
  const expiresAt = typeof claims.subscriptionExpiresAt === "number"
    ? claims.subscriptionExpiresAt
    : Number(claims.subscriptionExpiresAt);

  return status === "EXPIRED" || (Number.isFinite(expiresAt) && Math.floor(Date.now() / 1000) >= expiresAt);
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = isAllowedOrigin(origin);
  const headers = new Headers();

  if (allowed && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Token, X-Business-Id");
    headers.set("Access-Control-Max-Age", "86400");
  }

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers });
  }

  const authHeader = request.headers.get("authorization");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth/login");

  if (authHeader && /^Bearer\s+/i.test(authHeader) && !isAuthRoute) {
    try {
      const claims = decodeTokenClaims(authHeader.replace(/^Bearer\s+/i, "").trim());

      if (claims && subscriptionIsExpired(claims)) {
        headers.set("Content-Type", "application/json; charset=utf-8");
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: "PAYMENT_REQUIRED",
            message: "The MobiDuka subscription has expired. Please renew the subscription to continue.",
            ...(typeof claims.businessId === "string" ? { businessId: claims.businessId } : {}),
          }),
          { status: 402, headers },
        );
      }
    } catch {
      // Route handlers perform the authoritative signature and credential checks.
    }
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
