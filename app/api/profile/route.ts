import bcrypt from "bcryptjs";
import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { authenticatedBusinessId, authenticatedUserId, requireBusinessAccess } from "@/lib/auth";

function profileResponse(user: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  role: { name: string } | null;
  business: { id: string; name: string; branch: string | null; country: string | null; phone: string | null; email: string | null };
}) {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role?.name ?? "USER",
    memberSince: user.createdAt,
    business: {
      id: user.business.id,
      name: user.business.name,
      branch: user.business.branch,
      country: user.business.country,
      phone: user.business.phone,
      email: user.business.email,
    },
  };
}

const profileInclude = {
  role: { select: { name: true } },
  business: { select: { id: true, name: true, branch: true, country: true, phone: true, email: true } },
} as const;

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request);
    const userId = authenticatedUserId(request);
    if (!businessId || !userId) return NextResponse.json({ error: "Authenticated user context is required." }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { id: userId, businessId }, include: profileInclude });
    if (!user) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    return NextResponse.json({ profile: profileResponse(user) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load profile.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; name?: string; phone?: string | null; email?: string | null; currentPin?: string; newPin?: string };
    const businessId = requireBusinessAccess(request, body.businessId);
    const userId = authenticatedUserId(request);
    if (!businessId || !userId) return NextResponse.json({ error: "Authenticated user context is required." }, { status: 401 });

    const existing = await prisma.user.findFirst({ where: { id: userId, businessId }, include: profileInclude });
    if (!existing) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const data: { fullName?: string; phone?: string | null; email?: string | null; pinHash?: string } = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      data.fullName = body.name.trim();
    }
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim().toLowerCase() || null;
    if (body.newPin !== undefined) {
      if (!/^\d{4}$/.test(body.newPin)) return NextResponse.json({ error: "New PIN must be 4 digits." }, { status: 400 });
      if (!body.currentPin || !existing.pinHash) return NextResponse.json({ error: "Current PIN is required." }, { status: 400 });
      const matches = existing.pinHash.startsWith("$2")
        ? await bcrypt.compare(body.currentPin, existing.pinHash)
        : existing.pinHash === body.currentPin;
      if (!matches) return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 });
      data.pinHash = await bcrypt.hash(body.newPin, 10);
    }

    const updated = await prisma.user.update({ where: { id: existing.id }, data, include: profileInclude });
    return NextResponse.json({ profile: profileResponse(updated) });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Failed to update profile.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}