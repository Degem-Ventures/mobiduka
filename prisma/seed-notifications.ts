import { PrismaClient } from "@prisma/client";
import { demoNotifications } from "../data/demo-notifications";

const prisma = new PrismaClient();

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error("BUSINESS_ID is required");
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!business) throw new Error(`Business not found: ${businessId}`);

  for (const notification of demoNotifications) {
    const createdAt = new Date(notification.createdAt);
    const existing = await prisma.notification.findFirst({
      where: { businessId, title: notification.title, createdAt },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        businessId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt,
      },
    });
  }

  const notifications = await prisma.notification.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { title: true, type: true, isRead: true, createdAt: true },
  });
  console.log(JSON.stringify(notifications, null, 2));
}

main()
  .catch((error) => { console.error("Notification seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });