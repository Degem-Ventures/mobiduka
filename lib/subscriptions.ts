import type { PlatformSubscription, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export const TRIAL_DURATION_DAYS = 14;
export const SUBSCRIPTION_GRACE_DAYS = 7;

export type EffectiveSubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "GRACE"
  | "EXPIRED"
  | "REVOKED"
  | "MISSING";

export type SubscriptionSnapshot = {
  planType: string;
  status: EffectiveSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  graceEndsAt: Date | null;
  licenseCost: number;
  autoRenewActive: boolean;
  isTrialClaimed: boolean;
};

export class SubscriptionWriteDeniedError extends Error {
  constructor(
    readonly status: EffectiveSubscriptionStatus,
    readonly endsAt: Date | null,
  ) {
    super("The subscription does not allow new writes. Historical data remains available.");
    this.name = "SubscriptionWriteDeniedError";
  }
}

type SubscriptionReader = Pick<PrismaClient, "platformSubscription"> | Prisma.TransactionClient;

export function effectiveSubscriptionStatus(
  subscription: Pick<PlatformSubscription, "status" | "trialEndsAt" | "currentPeriodEndsAt" | "graceEndsAt"> | null,
  now = new Date(),
): EffectiveSubscriptionStatus {
  if (!subscription) return "MISSING";
  if (subscription.status === "REVOKED") return "REVOKED";
  if (subscription.status === "EXPIRED") return "EXPIRED";

  if (subscription.status === "TRIAL") {
    return subscription.trialEndsAt && subscription.trialEndsAt > now ? "TRIAL" : "EXPIRED";
  }

  const graceEndsAt =
    subscription.graceEndsAt ??
    (subscription.currentPeriodEndsAt
      ? new Date(subscription.currentPeriodEndsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000)
      : null);

  if (subscription.status === "GRACE") {
    return graceEndsAt && graceEndsAt > now ? "GRACE" : "EXPIRED";
  }

  if (subscription.status === "ACTIVE") {
    if (!subscription.currentPeriodEndsAt) return "EXPIRED";
    if (subscription.currentPeriodEndsAt > now) return "ACTIVE";
    return graceEndsAt && graceEndsAt > now ? "GRACE" : "EXPIRED";
  }

  return "EXPIRED";
}

export async function getSubscriptionSnapshot(
  client: SubscriptionReader,
  businessId: string,
  now = new Date(),
): Promise<SubscriptionSnapshot> {
  const subscription = await client.platformSubscription.findUnique({
    where: { businessId },
  });
  return {
    planType: subscription?.planType ?? "BASIC",
    status: effectiveSubscriptionStatus(subscription, now),
    trialEndsAt: subscription?.trialEndsAt ?? null,
    currentPeriodEndsAt: subscription?.currentPeriodEndsAt ?? null,
    graceEndsAt: subscription?.graceEndsAt ?? null,
    licenseCost: subscription?.licenseCost ?? 0,
    autoRenewActive: subscription?.autoRenewActive ?? false,
    isTrialClaimed: subscription?.isTrialClaimed ?? false,
  };
}

export async function canWriteForSubscription(
  client: SubscriptionReader,
  businessId: string,
  now = new Date(),
) {
  const subscription = await client.platformSubscription.findUnique({
    where: { businessId },
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEndsAt: true,
      graceEndsAt: true,
    },
  });
  const status = effectiveSubscriptionStatus(subscription, now);
  return {
    allowed: status === "TRIAL" || status === "ACTIVE" || status === "GRACE",
    status,
    endsAt:
      status === "TRIAL"
        ? subscription?.trialEndsAt ?? null
        : subscription?.graceEndsAt ?? subscription?.currentPeriodEndsAt ?? null,
  };
}
