import { NextResponse } from "next/server.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "mobiduka-dev-secret-change-me";

function signToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

function normalizeUserLookup(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier ?? "");
    const password = String(body.password ?? "");
    const pin = String(body.pin ?? "");
    const businessId = String(body.businessId ?? request.headers.get("x-business-id") ?? "").trim();

    if ((!identifier && !pin) || (!password && !pin) || (password && !identifier)) {
      return NextResponse.json(
        { error: "Business identifier and password, or business context and PIN, are required." },
        { status: 400 },
      );
    }

    const users = await prisma.user.findMany({
      where: {
        ...(businessId ? { businessId } : {}),
        ...(identifier ? {
          OR: [
            { email: normalizeUserLookup(identifier) },
            { username: normalizeUserLookup(identifier) },
          ],
        } : {}),
      },
      include: {
        role: true,
        business: {
          include: {
            licenses: {
              orderBy: { expiryDate: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (password) {
      const user = users[0];
      if (!user || user.status !== "ACTIVE") {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
      return completeLogin(user, password, "");
    }

    if (!businessId) {
      return NextResponse.json({ error: "Business context is required for PIN login." }, { status: 400 });
    }

    const activeUsers = users.filter((candidate) => candidate.status === "ACTIVE");
    let user = null;
    for (const candidate of activeUsers) {
      if (candidate.pinHash && (candidate.pinHash.startsWith("$2")
        ? bcrypt.compareSync(pin, candidate.pinHash)
        : safeHashCompare(candidate.pinHash, pin))) {
        user = candidate;
        break;
      }
    }

    if (!user) return NextResponse.json({ error: "Invalid PIN for this business." }, { status: 401 });
    return completeLogin(user, "", pin);
  } catch (error) {
    console.error("Auth login failed:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}

function safeHashCompare(storedHash: string, value: string) {
  const expected = crypto.createHash("sha256").update(value).digest("hex");
  const stored = Buffer.from(storedHash);
  const candidate = Buffer.from(expected);
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function completeLogin(user: any, password: string, pin: string) {
    let passwordMatches = false;
    let pinMatches = false;

    if (password && user.passwordHash) {
      passwordMatches = user.passwordHash.startsWith("$2")
        ? bcrypt.compareSync(password, user.passwordHash)
        : safeHashCompare(user.passwordHash, password);
    }

    if (pin && user.pinHash) {
      pinMatches = user.pinHash.startsWith("$2")
        ? bcrypt.compareSync(pin, user.pinHash)
        : safeHashCompare(user.pinHash, pin);
    }

    if (!passwordMatches && !pinMatches) {
      if (pin && user.pinHash) {
        return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
      }

      if (password && user.passwordHash) {
        return NextResponse.json({ error: "Invalid password." }, { status: 401 });
      }

      return NextResponse.json(
        { error: "This account does not have a configured PIN or password login method." },
        { status: 401 },
      );
    }

    const license = user.business.licenses[0];
    const licenseExpiresAt = license?.expiryDate
      ? Math.floor(license.expiryDate.getTime() / 1000)
      : undefined;
    const nowUnixTime = Math.floor(Date.now() / 1000);
    const businessStatus = user.business.status.trim().toUpperCase();
    const subscriptionStatus =
      businessStatus !== "ACTIVE" || license?.status?.toUpperCase() === "EXPIRED" ||
      (licenseExpiresAt !== undefined && nowUnixTime >= licenseExpiresAt)
        ? "EXPIRED"
        : businessStatus;

    const token = signToken({
      sub: user.id,
      businessId: user.businessId,
      role: user.role?.name ?? "CASHIER",
      subscriptionStatus,
      ...(licenseExpiresAt !== undefined ? { subscriptionExpiresAt: licenseExpiresAt } : {}),
      type: pin ? "pin" : "password",
      email: user.email,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role?.name ?? "CASHIER",
        businessId: user.businessId,
      },
    });
}
