import { sendPushNotification } from "./firebase-admin";
import { prisma } from "./prisma";

export type NotificationType = "critical" | "warning" | "success" | "info";

type CreateSystemNotificationParams = {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  eventKey?: string;
  preference?: "lowStockAlerts" | "salesNotifications";
};

const icons: Record<NotificationType, string> = {
  critical: "🔴",
  warning: "⚠️",
  success: "🎯",
  info: "📦",
};

function dailyEventKey(eventKey: string) {
  return `${eventKey}:${new Date().toISOString().slice(0, 10)}`;
}

export async function createSystemNotification({
  businessId,
  type,
  title,
  body,
  icon,
  eventKey,
  preference,
}: CreateSystemNotificationParams) {
  try {
    if (preference) {
      const settings = await prisma.businessSettings.findUnique({
        where: { businessId },
        select: { lowStockAlerts: true, salesNotifications: true },
      });
      if (settings && !settings[preference]) return null;
    }
    const persistedEventKey = eventKey ? dailyEventKey(eventKey) : null;
    const notification = await prisma.notification.create({
      data: {
        businessId,
        type,
        title,
        message: body,
        userId: null,
        eventKey: persistedEventKey,
      },
    });

    await sendPushNotification(
      `business_notifications_${businessId}`,
      `${icon ?? icons[type]} ${title}`,
      body,
      { businessId, notificationId: notification.id, type },
    );
    return notification;
  } catch (error: unknown) {
    // Notifications are auxiliary work and must not roll back a completed sale or receipt.
    if (error instanceof Error && error.message.includes("Unique constraint")) return null;
    console.error("Notification emission failed:", error instanceof Error ? error.message : error);
    return null;
  }
}