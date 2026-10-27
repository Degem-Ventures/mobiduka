import { NextResponse } from "next/server.js";
import { authenticatedPlatformAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const adminId = authenticatedPlatformAdminId(request);
  if (!adminId) return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 401 });
  const admin = await prisma.platformAdmin.findFirst({
    where: { id: adminId, status: "ACTIVE" },
    select: { email: true },
  });
  if (!admin) return NextResponse.json({ error: "Platform administrator is inactive." }, { status: 401 });
  return NextResponse.json({ admin });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("platform_admin_session", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin",
    maxAge: 0,
  });
  return response;
}
