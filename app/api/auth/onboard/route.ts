import { NextResponse } from "next/server.js";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES } from "@/lib/roles";
import { TRIAL_DURATION_DAYS } from "@/lib/subscriptions";
import { planCatalog } from "@/app/plans/plan-catalog";

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

    const existingOwner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (existingOwner) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const ownerRoleDefinition = SYSTEM_ROLES.find(role => role.name === "Admin");
    if (!ownerRoleDefinition) throw new Error("The default business owner role is unavailable.");
    const basicPlan = planCatalog.find(plan => plan.name === "Basic");
    if (!basicPlan) throw new Error("The default Basic plan is unavailable.");
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
          phone: body.phone?.trim() || null,
          businessType: body.businessType?.trim() || null,
          currency: "KES",
          timezone: "Africa/Nairobi",
          status: "ACTIVE",
        },
      });
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
          phone: body.phone?.trim() || null,
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
          planType: basicPlan.name.toUpperCase(),
          status: "TRIAL",
          trialEndsAt,
          licenseCost: basicPlan.monthlyPriceKsh,
          isTrialClaimed: true,
        },
      });
      return { businessId: business.id, owner };
    });

    return NextResponse.json({
      success: true,
      businessId: result.businessId,
      owner: result.owner,
      subscription: {
        planType: basicPlan.name.toUpperCase(),
        status: "TRIAL",
        trialEndsAt: trialEndsAt.toISOString(),
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
