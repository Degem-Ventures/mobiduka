import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const businessId = requireBusinessAccess(request, new URL(request.url).searchParams.get("businessId"));
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    const shiftTypes = await prisma.shiftType.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ shiftTypes });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load shift types.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = requireBusinessAccess(request, body.businessId);
    const code = String(body.code ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const scheduledStart = String(body.scheduledStart ?? "").trim();
    const scheduledEnd = String(body.scheduledEnd ?? "").trim();
    if (!businessId || !code || !name || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledEnd)) {
      return NextResponse.json({ error: "Business, code, name, and valid scheduled times are required." }, { status: 400 });
    }
    const shiftType = await prisma.shiftType.upsert({
      where: { businessId_code: { businessId, code } },
      update: { name, scheduledStart, scheduledEnd, icon: body.icon ? String(body.icon) : null, color: body.color ? String(body.color) : null, active: body.active !== false },
      create: { businessId, code, name, scheduledStart, scheduledEnd, icon: body.icon ? String(body.icon) : null, color: body.color ? String(body.color) : null, active: body.active !== false },
    });
    return NextResponse.json({ success: true, shiftType }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Shift type registration failed.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
