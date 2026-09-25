import crypto from "node:crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("FATAL BINDING ERROR: The JWT_SECRET environment configuration is completely missing.");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && secret === "mobiduka-dev-secret-change-me") {
    console.error("FATAL HARDENING ERROR: Weak developer credential detected within a production tier deployment.");
    process.exit(1);
  }

  return secret;
}

export const JWT_SECRET = getJwtSecret();

type TokenPayload = {
  sub?: unknown;
  businessId?: unknown;
  exp?: unknown;
};

function tokenPayload(request: Request): TokenPayload | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  const actual = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
}

export function authenticatedBusinessId(request: Request): string | null {
  const payload = tokenPayload(request);
  if (!payload || typeof payload.businessId !== "string") return null;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  return payload.businessId;
}

export function authenticatedUserId(request: Request): string | null {
  const payload = tokenPayload(request);
  if (!payload || typeof payload.sub !== "string") return null;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  return payload.sub;
}

export function requestedBusinessId(request: Request, value: unknown): string | null {
  const authenticatedId = authenticatedBusinessId(request);
  if (!authenticatedId) return null;
  if (value !== undefined && value !== null && String(value).trim() !== authenticatedId) return null;
  return authenticatedId;
}

export function requireBusinessAccess(request: Request, value: unknown): string | null {
  const businessId = requestedBusinessId(request, value);
  if (!businessId) return null;
  return businessId;
}