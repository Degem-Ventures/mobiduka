import { NextResponse } from "next/server.js";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authenticatedBusinessId } from "@/lib/auth";

const ROLE_NAMES = new Set(["ADMIN", "OWNER", "SUPERVISOR", "CASHIER", "ACCOUNTANT"]);

export async function POST(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request);
    if (!businessId) {
      return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    }

    const body = await request.json();
    const fullName = String(body.name ?? body.fullName ?? "").trim();
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
    const username = typeof body.username === "string" && body.username.trim() ? body.username.trim().toLowerCase() : null;
    const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const roleName = String(body.role ?? "CASHIER").trim().toUpperCase();
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!fullName || (!email && !username) || !ROLE_NAMES.has(roleName)) {
      return NextResponse.json(
        { error: "name, email or username, and a valid role are required." },
        { status: 400 },
      );
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must contain exactly 4 digits." }, { status: 400 });
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must contain at least 6 characters." }, { status: 400 });
    }
    if (!pin && !password) {
      return NextResponse.json({ error: "A PIN or password is required." }, { status: 400 });
    }

    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    if (email && await prisma.user.findFirst({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    if (username && await prisma.user.findFirst({ where: { username }, select: { id: true } })) {
      return NextResponse.json({ error: "That username is already registered." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        businessId,
        fullName,
        email,
        username,
        phone,
        roleId: role.id,
        pinHash: pin ? await bcrypt.hash(pin, 10) : null,
        passwordHash: password ? await bcrypt.hash(password, 10) : null,
        status: "ACTIVE",
      },
      select: { id: true, fullName: true, email: true, username: true, role: { select: { name: true } } },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to register user.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
