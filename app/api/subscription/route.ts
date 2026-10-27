import { NextResponse } from "next/server.js";
import { authenticatedBusinessId, authenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionSnapshot } from "@/lib/subscriptions";

export async function GET(request: Request) {
  const businessId = authenticatedBusinessId(request);
  if (!businessId) {
    return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
  }

  try {
    const subscription = await getSubscriptionSnapshot(prisma, businessId);
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Subscription status lookup failed:", error);
    return NextResponse.json({ error: "Unable to load subscription status." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const businessId = authenticatedBusinessId(request);
  const userId = authenticatedUserId(request);
  if (!businessId || !userId) {
    return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
  }

  try {
    const body = await request.json() as { autoRenewActive?: boolean };
    if (typeof body.autoRenewActive !== "boolean") {
      return NextResponse.json({ error: "autoRenewActive must be a boolean." }, { status: 400 });
    }
    const owner = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId,
        status: "ACTIVE",
        role: { name: { in: ["Admin", "OWNER", "ADMIN"] } },
      },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: "Business owner access is required." }, { status: 403 });

    const subscription = await prisma.platformSubscription.update({
      where: { businessId },
      data: { autoRenewActive: body.autoRenewActive },
    });
    return NextResponse.json({
      subscription: {
        planType: subscription.planType,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEndsAt: subscription.currentPeriodEndsAt,
        graceEndsAt: subscription.graceEndsAt,
        autoRenewActive: subscription.autoRenewActive,
        licenseCost: subscription.licenseCost,
      },
    });
  } catch (error) {
    console.error("Subscription preference update failed:", error);
    return NextResponse.json({ error: "Unable to update subscription preferences." }, { status: 500 });
  }
}
