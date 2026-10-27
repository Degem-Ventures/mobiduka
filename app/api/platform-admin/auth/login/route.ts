import { NextResponse } from "next/server.js";
import bcrypt from "bcryptjs";
import { createAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || admin.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid platform administrator credentials." }, { status: 401 });
    }
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      return NextResponse.json({ error: "Too many failed attempts. Try again later." }, { status: 429 });
    }
    if (!await bcrypt.compare(password, admin.passwordHash)) {
      const failedLoginAttempts = admin.failedLoginAttempts + 1;
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts,
          lockedUntil: failedLoginAttempts >= 5
            ? new Date(Date.now() + 15 * 60 * 1000)
            : null,
        },
      });
      return NextResponse.json({ error: "Invalid platform administrator credentials." }, { status: 401 });
    }
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    const token = createAuthToken({
      sub: admin.id,
      email: admin.email,
      role: "SUPER_ADMIN",
      scope: "platform-admin",
      iat: Math.floor(Date.now() / 1000),
      exp: expiresAt,
    });
    const response = NextResponse.json({ expiresAt });
    response.cookies.set("platform_admin_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/admin",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Platform admin login failed:", error);
    return NextResponse.json({ error: "Unable to authenticate platform administrator." }, { status: 500 });
  }
}
