import { NextResponse } from "next/server.js";
import { canWriteForSubscription } from "@/lib/subscriptions";
import { prisma } from "@/lib/prisma";

export async function subscriptionWriteLockResponse(businessId: string) {
  const access = await canWriteForSubscription(prisma, businessId);
  if (access.allowed) return null;

  return NextResponse.json(
    {
      error: "The subscription does not allow new writes. Historical data remains available.",
      code: "SUBSCRIPTION_WRITE_LOCKED",
      subscriptionStatus: access.status,
      endsAt: access.endsAt?.toISOString() ?? null,
    },
    { status: 402 },
  );
}
