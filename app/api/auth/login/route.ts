import { NextResponse } from "next/server";
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

    if (!identifier || (!password && !pin)) {
      return NextResponse.json(
        { error: "Email, username, or PIN is required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizeUserLookup(identifier) },
          { username: normalizeUserLookup(identifier) },
        ],
      },
      include: {
        role: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (pin) {
      if (!user.pinHash) {
        return NextResponse.json({ error: "PIN login is not enabled for this account." }, { status: 401 });
      }

      const validPin = user.pinHash.startsWith("$2")
        ? bcrypt.compareSync(pin, user.pinHash)
        : crypto.timingSafeEqual(
            Buffer.from(user.pinHash),
            Buffer.from(crypto.createHash("sha256").update(pin).digest("hex")),
          );

      if (!validPin) {
        return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
      }
    } else if (password) {
      if (!user.passwordHash) {
        return NextResponse.json({ error: "Password login is not enabled for this account." }, { status: 401 });
      }

      const validPassword = user.passwordHash.startsWith("$2")
        ? bcrypt.compareSync(password, user.passwordHash)
        : crypto.timingSafeEqual(
            Buffer.from(user.passwordHash),
            Buffer.from(crypto.createHash("sha256").update(password).digest("hex")),
          );

      if (!validPassword) {
        return NextResponse.json({ error: "Invalid password." }, { status: 401 });
      }
    }

    const token = signToken({
      sub: user.id,
      businessId: user.businessId,
      role: user.role?.name ?? "CASHIER",
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
  } catch (error) {
    console.error("Auth login failed:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
