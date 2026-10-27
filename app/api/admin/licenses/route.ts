import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { planCatalog } from "@/app/plans/plan-catalog";
import { effectiveSubscriptionStatus, TRIAL_DURATION_DAYS } from "@/lib/subscriptions";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 });

  try {
    const [subscriptions, legacyLicenses, legacyLicenseCount] = await Promise.all([
      prisma.platformSubscription.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          business: {
            select: { id: true, name: true, ownerName: true, email: true, status: true },
          },
        },
      }),
      prisma.license.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          businessId: true,
          licenseType: true,
          deviceLimit: true,
          expiryDate: true,
          status: true,
          createdAt: true,
          business: {
            select: { name: true, ownerName: true, email: true },
          },
        },
      }),
      prisma.license.count(),
    ]);
    return NextResponse.json({
      subscriptions: subscriptions.map(subscription => ({
        ...subscription,
        status: effectiveSubscriptionStatus(subscription),
      })),
      legacyLicenses,
      legacyLicenseCount,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Platform subscription list failed:", error);
    return NextResponse.json({ error: "Unable to load subscription records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 });

  try {
    const body = await request.json() as {
      action?: string;
      businessId?: string;
      planType?: string;
      durationDays?: number;
    };
    const businessId = body.businessId?.trim() ?? "";
    if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

    if (body.action === "PROVISION_TRIAL") {
      const durationDays = body.durationDays ?? TRIAL_DURATION_DAYS;
      const plan = planCatalog.find(item => item.name.toUpperCase() === body.planType?.toUpperCase());
      if (!plan || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > TRIAL_DURATION_DAYS) {
        return NextResponse.json({ error: "Select a valid plan and trial duration from 1 to 14 days." }, { status: 400 });
      }
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
      if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
      const existing = await prisma.platformSubscription.findUnique({ where: { businessId }, select: { id: true } });
      if (existing) return NextResponse.json({ error: "A subscription has already been claimed for this business." }, { status: 409 });

      const subscription = await prisma.platformSubscription.create({
        data: {
          businessId,
          planType: plan.name.toUpperCase(),
          status: "TRIAL",
          trialEndsAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          licenseCost: plan.monthlyPriceKsh,
          isTrialClaimed: true,
        },
      });
      return NextResponse.json({ subscription }, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported subscription action." }, { status: 400 });
  } catch (error) {
    console.error("Platform subscription provisioning failed:", error);
    return NextResponse.json({ error: "Unable to provision subscription." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "SUPER_ADMIN access is required." }, { status: 403 });

  try {
    const body = await request.json() as {
      action?: string;
      subscriptionId?: string;
      planType?: string;
      durationDays?: number;
      autoRenewActive?: boolean;
    };
    const subscriptionId = body.subscriptionId?.trim() ?? "";
    if (!subscriptionId) return NextResponse.json({ error: "subscriptionId is required." }, { status: 400 });

    if (body.action === "AUTO_RENEW") {
      if (typeof body.autoRenewActive !== "boolean") {
        return NextResponse.json({ error: "autoRenewActive must be a boolean." }, { status: 400 });
      }
      const subscription = await prisma.platformSubscription.update({
        where: { id: subscriptionId },
        data: { autoRenewActive: body.autoRenewActive },
      });
      return NextResponse.json({ subscription });
    }

    if (body.action === "REVOKE") {
      const subscription = await prisma.platformSubscription.update({
        where: { id: subscriptionId },
        data: { status: "REVOKED", autoRenewActive: false },
      });
      return NextResponse.json({ subscription });
    }

    if (body.action === "ACTIVATE" || body.action === "RENEW") {
      const plan = planCatalog.find(item => item.name.toUpperCase() === body.planType?.toUpperCase());
      const durationDays = body.durationDays ?? 30;
      if (!plan || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 366) {
        return NextResponse.json({ error: "Select a valid plan and billing duration from 1 to 366 days." }, { status: 400 });
      }
      const current = await prisma.platformSubscription.findUnique({
        where: { id: subscriptionId },
        select: { currentPeriodEndsAt: true },
      });
      if (!current) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
      const periodStart = current.currentPeriodEndsAt && current.currentPeriodEndsAt > new Date()
        ? current.currentPeriodEndsAt
        : new Date();
      const currentPeriodEndsAt = new Date(periodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const subscription = await prisma.platformSubscription.update({
        where: { id: subscriptionId },
        data: {
          planType: plan.name.toUpperCase(),
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEndsAt,
          graceEndsAt: null,
          licenseCost: plan.monthlyPriceKsh,
          autoRenewActive: body.autoRenewActive ?? true,
          isTrialClaimed: true,
        },
      });
      return NextResponse.json({ subscription });
    }

    return NextResponse.json({ error: "Unsupported subscription action." }, { status: 400 });
  } catch (error) {
    console.error("Platform subscription update failed:", error);
    return NextResponse.json({ error: "Unable to update subscription." }, { status: 500 });
  }
}
