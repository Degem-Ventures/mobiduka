import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

const icons: Record<string, string> = { critical: "🔴", warning: "⚠️", success: "🎯", info: "📦" };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = requireBusinessAccess(request, searchParams.get("businessId"));

    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const notifications = await prisma.notification.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: "desc" } });

    return NextResponse.json({
      success: true,
      unreadCount: notifications.filter(notification => !notification.isRead).length,
      notifications: notifications.map(notification => ({ id: notification.id, type: notification.type ?? "info", title: notification.title, body: notification.message, createdAt: notification.createdAt, read: notification.isRead, icon: icons[notification.type ?? "info"] ?? icons.info })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch active alert flags.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; userId?: string | null; title?: string; message?: string; type?: string; isRead?: boolean };
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (!body.title?.trim() || !body.message?.trim()) return NextResponse.json({ error: "Notification title and message are required." }, { status: 400 });

    const notification = await prisma.notification.create({
      data: { businessId, userId: body.userId ?? null, title: body.title.trim(), message: body.message.trim(), type: body.type ?? "info", isRead: body.isRead ?? false },
    });
    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create notification.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { businessId?: string; id?: string; markAllRead?: boolean; title?: string; message?: string; type?: string; isRead?: boolean };
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (body.markAllRead) {
      const result = await prisma.notification.updateMany({ where: { businessId, isRead: false, deletedAt: null }, data: { isRead: true } });
      return NextResponse.json({ success: true, updated: result.count });
    }
    if (!body.id) return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
    const existing = await prisma.notification.findFirst({ where: { id: body.id, businessId, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    const result = await prisma.notification.update({
      where: { id: body.id },
      data: {
        ...(body.title?.trim() ? { title: body.title.trim() } : {}),
        ...(body.message?.trim() ? { message: body.message.trim() } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(typeof body.isRead === "boolean" ? { isRead: body.isRead } : { isRead: true }),
      },
    });
    return NextResponse.json({ success: true, notification: result });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update notification.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({})) as { businessId?: string; id?: string };
    const businessId = requireBusinessAccess(request, body.businessId ?? searchParams.get("businessId"));
    const id = body.id ?? searchParams.get("id");
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Notification id is required." }, { status: 400 });

    const result = await prisma.notification.updateMany({
      where: { id, businessId, deletedAt: null, isRead: true },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ error: "Only an existing read notification can be deleted." }, { status: 409 });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete notification.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
