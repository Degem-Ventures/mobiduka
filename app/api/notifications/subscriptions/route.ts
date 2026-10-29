import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { authenticatedUserId, requireBusinessAccess } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; token?: string; platform?: string };
    const businessId = requireBusinessAccess(request, body.businessId);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!businessId || !token) return NextResponse.json({ error: "Authenticated business and token are required." }, { status: 401 });
    const platform = body.platform;
    if (!platform || !["web", "android", "ios"].includes(platform)) {
      return NextResponse.json({ error: "A supported push platform is required." }, { status: 400 });
    }

    const userId = authenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });
    const subscription = await prisma.notificationSubscription.upsert({
      where: { token },
      update: { businessId, userId, platform },
      create: { businessId, userId, token, platform },
    });
    return NextResponse.json({ success: true, subscriptionId: subscription.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to register push subscription.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; token?: string };
    const businessId = requireBusinessAccess(request, body.businessId);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!businessId || !token) return NextResponse.json({ error: "Authenticated business and token are required." }, { status: 401 });
    await prisma.notificationSubscription.deleteMany({ where: { businessId, token } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to unregister push subscription.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}