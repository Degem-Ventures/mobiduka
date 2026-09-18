import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "mobiduka-dev-secret-change-me";

type TokenPayload = {
  sub?: unknown;
  businessId?: unknown;
  exp?: unknown;
};

export function authenticatedBusinessId(request: Request): string | null {
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
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.businessId !== "string") return null;
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
    return payload.businessId;
  } catch {
    return null;
  }
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