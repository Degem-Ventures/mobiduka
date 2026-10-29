import { NextResponse } from "next/server.js";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES } from "@/lib/roles";
import { TRIAL_DURATION_DAYS } from "@/lib/subscriptions";
import {
  normalizePlatformPhone,
  platformMpesaCheckoutAvailable,
} from "@/lib/platform-mpesa";
import { getBusinessStarterTemplate } from "@/lib/business-starter-templates";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.BUSINESS_REGISTRATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Business self-registration is not enabled." }, { status: 503 });
  }
  try {
    const body = await request.json() as {
      businessName?: string;
      ownerName?: string;
      ownerEmail?: string;
      password?: string;
      initialPin?: string;
      phone?: string;
      businessType?: string;
      planName?: string;
      billingPeriod?: string;
      includeStarterCatalog?: boolean;
    };
    const businessName = body.businessName?.trim() ?? "";
    const ownerName = body.ownerName?.trim() ?? "";
    const ownerEmail = body.ownerEmail?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const initialPin = body.initialPin?.trim() ?? "";

    if (!businessName || !ownerName || !ownerEmail || !password) {
      return NextResponse.json(
        { error: "Business name, owner name, email, and password are required." },
        { status: 400 },
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return NextResponse.json({ error: "Enter a valid owner email address." }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: "Password must contain at least 12 characters." }, { status: 400 });
    }
    if (initialPin && !/^\d{4}$/.test(initialPin)) {
      return NextResponse.json({ error: "Initial PIN must contain exactly 4 digits." }, { status: 400 });
    }
    if (
      body.billingPeriod !== undefined &&
      body.billingPeriod !== "monthly" &&
      body.billingPeriod !== "annual"
    ) {
      return NextResponse.json({ error: "billingPeriod must be monthly or annual." }, { status: 400 });
    }
    if (
      body.includeStarterCatalog !== undefined &&
      typeof body.includeStarterCatalog !== "boolean"
    ) {
      return NextResponse.json({ error: "includeStarterCatalog must be a boolean." }, { status: 400 });
    }
    const businessType = body.businessType?.trim() || null;
    const includeStarterCatalog = body.includeStarterCatalog === true;
    const starterTemplate = getBusinessStarterTemplate(businessType);
    if (includeStarterCatalog && !starterTemplate) {
      return NextResponse.json(
        { error: "Choose a supported business type before adding its starter catalog." },
        { status: 400 },
      );
    }
    const planName = body.planName?.trim() || "Basic";
    const billingPeriod = body.billingPeriod === "annual" ? "annual" : "monthly";

    const existingOwner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (existingOwner) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const ownerRoleDefinition = SYSTEM_ROLES.find(role => role.name === "Admin");
    if (!ownerRoleDefinition) throw new Error("The default business owner role is unavailable.");
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: planName, isActive: true },
      select: {
        name: true,
        monthlyPriceKsh: true,
        publicMonthlyPriceKsh: true,
        annualPriceKsh: true,
        onlineCheckoutEnabled: true,
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "The selected plan is unavailable." }, { status: 400 });
    }
    const requiresPayment = plan.name !== "Basic";
    const publicPrice = billingPeriod === "annual" ? plan.annualPriceKsh : plan.publicMonthlyPriceKsh;
    if (requiresPayment && (!plan.onlineCheckoutEnabled || !publicPrice)) {
      return NextResponse.json({ error: "This plan is not currently configured for online checkout." }, { status: 400 });
    }
    const paymentPhone = requiresPayment ? normalizePlatformPhone(body.phone) : null;
    if (requiresPayment && !paymentPhone) {
      return NextResponse.json({ error: "A valid Kenyan mobile number is required for subscription checkout." }, { status: 400 });
    }
    if (requiresPayment && !platformMpesaCheckoutAvailable()) {
      return NextResponse.json({ error: "Online subscription checkout is not configured yet." }, { status: 503 });
    }
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const [passwordHash, pinHash] = await Promise.all([
      bcrypt.hash(password, 12),
      initialPin ? bcrypt.hash(initialPin, 12) : Promise.resolve(null),
    ]);

    const result = await prisma.$transaction(async transaction => {
      const business = await transaction.business.create({
        data: {
          name: businessName,
          ownerName,
          email: ownerEmail,
          phone: paymentPhone ?? (body.phone?.trim() || null),
          businessType,
          currency: "KES",
          timezone: "Africa/Nairobi",
          status: "ACTIVE",
        },
      });
      let starterCatalogProductCount = 0;
      if (includeStarterCatalog && starterTemplate) {
        const categoryIds = new Map<string, string>();
        for (const category of starterTemplate.categories) {
          const createdCategory = await transaction.category.create({
            data: {
              businessId: business.id,
              name: category.name,
              emoji: category.emoji,
              reportGroup: category.reportGroup,
            },
            select: { id: true, name: true },
          });
          categoryIds.set(createdCategory.name, createdCategory.id);
        }
        for (const item of starterTemplate.products) {
          const categoryId = categoryIds.get(item.category);
          if (!categoryId) {
            throw new Error(
              `Starter catalog category "${item.category}" is not configured.`,
            );
          }
          await transaction.product.create({
            data: {
              businessId: business.id,
              categoryId,
              name: `[Sample] ${item.name}`,
              unit: item.unit,
              emoji: item.emoji,
              costPrice: 0,
              sellingPrice: 0,
              minimumStock: 0,
              trackStock: true,
              status: "ACTIVE",
              inventory: {
                create: {
                  businessId: business.id,
                  quantity: 0,
                  reservedQuantity: 0,
                },
              },
            },
          });
          starterCatalogProductCount += 1;
        }
      }
      const role = await transaction.role.create({
        data: {
          businessId: business.id,
          name: ownerRoleDefinition.name,
          description: "Business owner",
          isSystem: true,
          icon: ownerRoleDefinition.icon,
          color: ownerRoleDefinition.color,
          permissions: {
            create: ownerRoleDefinition.permissions.map(permissionKey => ({ permissionKey })),
          },
        },
      });
      const owner = await transaction.user.create({
        data: {
          businessId: business.id,
          roleId: role.id,
          fullName: ownerName,
          email: ownerEmail,
          phone: paymentPhone ?? (body.phone?.trim() || null),
          passwordHash,
          pinHash,
          status: "ACTIVE",
        },
        select: { id: true, fullName: true, email: true },
      });
      await transaction.businessSettings.create({
        data: { businessId: business.id },
      });
      await transaction.platformSubscription.create({
        data: {
          businessId: business.id,
          planType: plan.name.toUpperCase(),
          status: requiresPayment ? "PENDING" : "TRIAL",
          trialEndsAt: requiresPayment ? null : trialEndsAt,
          licenseCost: plan.monthlyPriceKsh,
          isTrialClaimed: true,
        },
      });
      return { businessId: business.id, owner, starterCatalogProductCount };
    });

    return NextResponse.json({
      success: true,
      businessId: result.businessId,
      owner: result.owner,
      requiresPayment,
      planName: plan.name,
      starterCatalogProductCount: result.starterCatalogProductCount,
      subscription: {
        planType: plan.name.toUpperCase(),
        status: requiresPayment ? "PENDING" : "TRIAL",
        trialEndsAt: requiresPayment ? null : trialEndsAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    console.error("Business trial onboarding failed:", error);
    return NextResponse.json(
      { error: "Unable to create the business trial account." },
      { status: 500 },
    );
  }
}
