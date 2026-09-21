import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { authenticatedBusinessId, requireBusinessAccess } from "@/lib/auth";

const CURRENCY_OPTIONS = [
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "UGX", label: "UGX — Ugandan Shilling" },
  { code: "TZS", label: "TZS — Tanzanian Shilling" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
] as const;

const settingsSelect = {
  id: true,
  name: true,
  branch: true,
  country: true,
  phone: true,
  kraPin: true,
  currency: true,
  settings: {
    select: {
      receiptPrint: true,
      lowStockAlerts: true,
      salesNotifications: true,
      dailyReport: true,
      autoBackup: true,
      mpesaEnabled: true,
      themeMode: true,
      paymentConfig: true,
    },
  },
} as const;

function responseFor(business: {
  id: string;
  name: string;
  branch: string | null;
  country: string | null;
  phone: string | null;
  kraPin: string | null;
  currency: string | null;
  settings: {
    receiptPrint: boolean;
    lowStockAlerts: boolean;
    salesNotifications: boolean;
    dailyReport: boolean;
    autoBackup: boolean;
    mpesaEnabled: boolean;
    themeMode: string;
    paymentConfig: unknown;
  } | null;
}) {
  return {
    business: {
      id: business.id,
      name: business.name,
      branch: business.branch,
      country: business.country,
      phone: business.phone,
      taxPin: business.kraPin,
      currency: business.currency ?? "KES",
    },
    preferences: business.settings ?? {
      receiptPrint: true,
      lowStockAlerts: true,
      salesNotifications: true,
      dailyReport: false,
      autoBackup: true,
      mpesaEnabled: true,
      themeMode: "light",
      paymentConfig: null,
    },
    currencyOptions: CURRENCY_OPTIONS,
  };
}

async function loadBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: settingsSelect });
  if (!business) return null;
  if (!business.settings) {
    await prisma.businessSettings.create({ data: { businessId } });
    return prisma.business.findUnique({ where: { id: businessId }, select: settingsSelect });
  }
  return business;
}

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    const business = await loadBusiness(businessId);
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    return NextResponse.json(responseFor(business));
  } catch (error) {
    return NextResponse.json({ error: "Failed to load settings.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      businessId?: string;
      currency?: string;
      taxPin?: string | null;
      receiptPrint?: boolean;
      lowStockAlerts?: boolean;
      salesNotifications?: boolean;
      dailyReport?: boolean;
      autoBackup?: boolean;
      mpesaEnabled?: boolean;
      themeMode?: string;
      paymentConfig?: unknown;
    };
    const businessId = requireBusinessAccess(request, body.businessId);
    if (!businessId) return NextResponse.json({ error: "Authenticated business context is required." }, { status: 401 });
    if (body.currency !== undefined && !CURRENCY_OPTIONS.some(option => option.code === body.currency)) {
      return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
    }
    if (body.themeMode !== undefined && !["light", "dark", "auto"].includes(body.themeMode)) {
      return NextResponse.json({ error: "Unsupported theme mode." }, { status: 400 });
    }

    const businessData = {
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.taxPin !== undefined ? { kraPin: body.taxPin?.trim() || null } : {}),
    };
    if (Object.keys(businessData).length > 0) await prisma.business.update({ where: { id: businessId }, data: businessData });

    const preferenceKeys = ["receiptPrint", "lowStockAlerts", "salesNotifications", "dailyReport", "autoBackup", "mpesaEnabled"] as const;
    const preferences = Object.fromEntries(preferenceKeys.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    const settingsData = {
      ...preferences,
      ...(body.themeMode !== undefined ? { themeMode: body.themeMode } : {}),
      ...(body.paymentConfig !== undefined ? { paymentConfig: body.paymentConfig as object } : {}),
    };
    if (Object.keys(settingsData).length > 0) await prisma.businessSettings.upsert({ where: { businessId }, create: { businessId, ...settingsData }, update: settingsData });

    const business = await loadBusiness(businessId);
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    return NextResponse.json(responseFor(business));
  } catch (error) {
    return NextResponse.json({ error: "Failed to save settings.", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}