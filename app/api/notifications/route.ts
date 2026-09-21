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

    const limitValue = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
    const cursor = searchParams.get("cursor");
    const read = searchParams.get("read");
    const type = searchParams.get("type");
    const where = {
      businessId,
      deletedAt: null,
      ...(read === "true" || read === "false" ? { isRead: read === "true" } : {}),
      ...(type ? { type } : {}),
    };
    const [notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      prisma.notification.count({ where: { businessId, deletedAt: null, isRead: false } }),
    ]);
    const hasNextPage = notifications.length > limit;
    if (hasNextPage) notifications.pop();

    return NextResponse.json({
      success: true,
      unreadCount,
      nextCursor: hasNextPage ? notifications.at(-1)?.id ?? null : null,
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

    const userId = body.userId ? String(body.userId) : null;
    if (userId && !(await prisma.user.findFirst({ where: { id: userId, businessId }, select: { id: true } }))) {
      return NextResponse.json({ error: "User does not belong to this business." }, { status: 403 });
    }
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
    const body = await request.json() as { businessId?: string; id?: string; notificationId?: string; notificationIds?: string[]; markAllRead?: boolean; markAllAsRead?: boolean; title?: string; message?: string; type?: string; isRead?: boolean };
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (body.markAllRead || body.markAllAsRead) {
      const result = await prisma.notification.updateMany({ where: { businessId, isRead: false, deletedAt: null }, data: { isRead: true } });
      return NextResponse.json({ success: true, message: "Notification state updated.", updated: result.count });
    }
    const ids = body.notificationIds?.filter((id): id is string => typeof id === "string") ?? [];
    const targetIds = ids.length ? ids : [body.notificationId ?? body.id].filter((id): id is string => Boolean(id));
    if (!targetIds.length) return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
    const existing = await prisma.notification.findFirst({ where: { id: { in: targetIds }, businessId, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    if (targetIds.length > 1 || (!body.title && !body.message && !body.type && body.isRead === undefined)) {
      const result = await prisma.notification.updateMany({ where: { id: { in: targetIds }, businessId, deletedAt: null }, data: { isRead: true } });
      return NextResponse.json({ success: true, message: "Notification state updated.", updated: result.count });
    }
    const result = await prisma.notification.update({
      where: { id: targetIds[0] },
      data: {
        ...(body.title?.trim() ? { title: body.title.trim() } : {}),
        ...(body.message?.trim() ? { message: body.message.trim() } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(typeof body.isRead === "boolean" ? { isRead: body.isRead } : { isRead: true }),
      },
    });
    return NextResponse.json({ success: true, message: "Notification state updated.", notification: result });
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
